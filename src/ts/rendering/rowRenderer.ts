/// <reference path="../utils.ts" />
/// <reference path="../constants.ts" />
/// <reference path="renderedRow.ts" />
/// <reference path="../cellRenderers/groupCellRendererFactory.ts" />
/// <reference path="../cellRenderers/multilineCellRenderer.ts" />
/// <reference path="../cellRenderers/groupHeader.ts" />
/// <reference path="../entities/rowNode.ts" />

module ag.grid {

    var _ = Utils;

    export class RowRenderer {

        private columnModel: any;
        private gridOptionsWrapper: GridOptionsWrapper;
        private angularGrid: Grid;
        private selectionRendererFactory: SelectionRendererFactory;
        private gridPanel: GridPanel;
        private $compile: any;
        private $scope: any;
        private selectionController: SelectionController;
        private expressionService: ExpressionService;
        private templateService: TemplateService;
        private cellRendererMap: {[key: string]: any};
        private rowModel: any;
        private firstVirtualRenderedRow: number;
        private lastVirtualRenderedRow: number;
        private focusedCell: any;
        private valueService: ValueService;
        private eventService: EventService;

        private renderedRows: {[key: string]: RenderedRow};
        private renderedTopFloatingRows: RenderedRow[] = [];
        private renderedBottomFloatingRows: RenderedRow[] = [];

        private eAllBodyContainers: HTMLElement[];
        private eAllPinnedContainers: HTMLElement[];

        private eBodyContainer: HTMLElement;
        private eBodyViewport: HTMLElement;
        private ePinnedColsContainer: HTMLElement;
        private eFloatingTopContainer: HTMLElement;
        private eFloatingTopPinnedContainer: HTMLElement;
        private eFloatingBottomContainer: HTMLElement;
        private eFloatingBottomPinnedContainer: HTMLElement;
        private eParentsOfRows: HTMLElement[];

        private hoveredOn: any;
        private isSingleRow: boolean;

        public init(columnModel: any, gridOptionsWrapper: GridOptionsWrapper, gridPanel: GridPanel,
                    angularGrid: Grid, selectionRendererFactory: SelectionRendererFactory, $compile: any, $scope: any,
                    selectionController: SelectionController, expressionService: ExpressionService,
                    templateService: TemplateService, valueService: ValueService, eventService: EventService) {
            this.columnModel = columnModel;
            this.gridOptionsWrapper = gridOptionsWrapper;
            this.angularGrid = angularGrid;
            this.selectionRendererFactory = selectionRendererFactory;
            this.gridPanel = gridPanel;
            this.$compile = $compile;
            this.$scope = $scope;
            this.selectionController = selectionController;
            this.expressionService = expressionService;
            this.templateService = templateService;
            this.valueService = valueService;
            this.findAllElements(gridPanel);
            this.eventService = eventService;
            this.hoveredOn = undefined;
            this.isSingleRow = true;

            this.cellRendererMap = {
                'group': groupCellRendererFactory(gridOptionsWrapper, selectionRendererFactory, expressionService),
                'groupHeader': groupHeaderFactory(gridOptionsWrapper, selectionRendererFactory, expressionService),
                'multiline': multilineCellRendererFactory(gridOptionsWrapper),
                'default': function(params: any) {
                    return params.value;
                }
            };

            // map of row ids to row objects. keeps track of which elements
            // are rendered for which rows in the dom.
            this.renderedRows = {};
        }

        public setRowModel(rowModel: any) {
            this.rowModel = rowModel;
        }

        public onIndividualColumnResized(column: Column) {
            var newWidthPx = column.actualWidth + "px";
            var selectorForAllColsInCell = ".cell-col-" + column.index;
            this.eParentsOfRows.forEach( function(rowContainer: HTMLElement) {
                var cellsForThisCol: NodeList = rowContainer.querySelectorAll(selectorForAllColsInCell);
                for (var i = 0; i < cellsForThisCol.length; i++) {
                    var element = <HTMLElement> cellsForThisCol[i];
                    element.style.width = newWidthPx;
                }
            });
        }

        public setMainRowWidths() {
            var mainRowWidth = this.columnModel.getBodyContainerWidth() + "px";

            this.eAllBodyContainers.forEach( function(container: HTMLElement) {
                var unpinnedRows: [any] = (<any>container).querySelectorAll(".ag-row");
                for (var i = 0; i < unpinnedRows.length; i++) {
                    unpinnedRows[i].style.width = mainRowWidth;
                }
            });
        }

        private findAllElements(gridPanel: any) {
            this.eBodyContainer = gridPanel.getBodyContainer();
            this.ePinnedColsContainer = gridPanel.getPinnedColsContainer();

            this.eFloatingTopContainer = gridPanel.getFloatingTopContainer();
            this.eFloatingTopPinnedContainer = gridPanel.getPinnedFloatingTop();

            this.eFloatingBottomContainer = gridPanel.getFloatingBottomContainer();
            this.eFloatingBottomPinnedContainer = gridPanel.getPinnedFloatingBottom();

            this.eBodyViewport = gridPanel.getBodyViewport();
            this.eParentsOfRows = gridPanel.getRowsParent();

            this.eAllBodyContainers = [this.eBodyContainer, this.eFloatingBottomContainer,
                this.eFloatingTopContainer];
            this.eAllPinnedContainers = [this.ePinnedColsContainer, this.eFloatingBottomPinnedContainer,
                this.eFloatingTopPinnedContainer];
        }

        public refreshAllFloatingRows(): void {
            this.refreshFloatingRows(
                this.renderedTopFloatingRows,
                this.gridOptionsWrapper.getFloatingTopRowData(),
                this.eFloatingTopPinnedContainer,
                this.eFloatingTopContainer,
                true);
            this.refreshFloatingRows(
                this.renderedBottomFloatingRows,
                this.gridOptionsWrapper.getFloatingBottomRowData(),
                this.eFloatingBottomPinnedContainer,
                this.eFloatingBottomContainer,
                false);
        }

        private refreshFloatingRows(renderedRows: RenderedRow[], rowData: any[],
                                    pinnedContainer: HTMLElement, bodyContainer: HTMLElement,
                                    isTop: boolean): void {
            renderedRows.forEach( (row: RenderedRow) => {
                row.destroy();
            });

            renderedRows.length = 0;

            // if no cols, don't draw row - can we get rid of this???
            var columns = this.columnModel.getDisplayedColumns();
            if (!columns || columns.length == 0) {
                return;
            }

            // should we be storing this somewhere???
            var mainRowWidth = this.columnModel.getBodyContainerWidth();

            if (rowData) {
                rowData.forEach( (data: any, rowIndex: number) => {
                    var node: RowNode = {
                        data: data,
                        floating: true,
                        floatingTop: isTop,
                        floatingBottom: !isTop
                    };
                    var renderedRow = new RenderedRow(this.gridOptionsWrapper, this.valueService, this.$scope, this.angularGrid,
                        this.columnModel, this.expressionService, this.cellRendererMap, this.selectionRendererFactory,
                        this.$compile, this.templateService, this.selectionController, this,
                        bodyContainer, pinnedContainer, node, rowIndex, this.eventService);
                    renderedRow.setMainRowWidth(mainRowWidth);
                    renderedRows.push(renderedRow);
                })
            }
        }

        public refreshView(refreshFromIndex?: any) {
            if (!this.gridOptionsWrapper.isForPrint()) {
                var rowCount = this.rowModel.getGridRowCount();
                var containerHeight = this.gridOptionsWrapper.getRowHeight() * rowCount;

                // debugger;
                this.eBodyContainer.style.height = containerHeight + "px";
                // this.gridPanel.getLayout().setRowOverlayRowHeight(this.eBodyContainer.style.height);

                this.ePinnedColsContainer.style.height = containerHeight + "px";
            }

            this.refreshAllVirtualRows(refreshFromIndex);
            this.refreshAllFloatingRows();
            this.selectionController.refreshSelection();
        }

        public softRefreshView() {
            _.iterateObject(this.renderedRows, (key: any, renderedRow: RenderedRow)=> {
                renderedRow.softRefresh();
            });
        }

        public refreshRows(rowNodes: RowNode[]): void {
            if (!rowNodes || rowNodes.length==0) {
                return;
            }
            // we only need to be worried about rendered rows, as this method is
            // called to whats rendered. if the row isn't rendered, we don't care
            var indexesToRemove: any = [];
            _.iterateObject(this.renderedRows, (key: string, renderedRow: RenderedRow)=> {
                var rowNode = renderedRow.getRowNode();
                if (rowNodes.indexOf(rowNode)>=0) {
                    indexesToRemove.push(key);
                }
            });
            // remove the rows
            this.removeVirtualRow(indexesToRemove);
            // add draw them again
            this.drawVirtualRows();
        }

        public refreshCells(rowNodes: RowNode[], colIds: string[]): void {
            if (!rowNodes || rowNodes.length==0) {
                return;
            }
            // we only need to be worried about rendered rows, as this method is
            // called to whats rendered. if the row isn't rendered, we don't care
            _.iterateObject(this.renderedRows, (key: string, renderedRow: RenderedRow)=> {
                var rowNode = renderedRow.getRowNode();
                if (rowNodes.indexOf(rowNode)>=0) {
                    renderedRow.refreshCells(colIds);
                }
            });
        }

        public rowDataChanged(rows: any) {
            // we only need to be worried about rendered rows, as this method is
            // called to whats rendered. if the row isn't rendered, we don't care
            var indexesToRemove: any = [];
            var renderedRows = this.renderedRows;
            Object.keys(renderedRows).forEach(function (key: any) {
                var renderedRow = renderedRows[key];
                // see if the rendered row is in the list of rows we have to update
                if (renderedRow.isDataInList(rows)) {
                    indexesToRemove.push(key);
                }
            });
            // remove the rows
            this.removeVirtualRow(indexesToRemove);
            // add draw them again
            this.drawVirtualRows();
        }

        private refreshAllVirtualRows(fromIndex: any) {
            // remove all current virtual rows, as they have old data
            var rowsToRemove = Object.keys(this.renderedRows);
            this.removeVirtualRow(rowsToRemove, fromIndex);

            // add in new rows
            this.countGridRows();
            this.drawVirtualRows();
        }

        // public - removes the group rows and then redraws them again
        public refreshGroupRows() {
            // find all the group rows
            var rowsToRemove: any = [];
            var that = this;
            Object.keys(this.renderedRows).forEach(function (key: any) {
                var renderedRow = that.renderedRows[key];
                if (renderedRow.isGroup()) {
                    rowsToRemove.push(key);
                }
            });
            // remove the rows
            this.removeVirtualRow(rowsToRemove);
            // and draw them back again
            this.ensureRowsRendered();
        }

        // takes array of row indexes
        private removeVirtualRow(rowsToRemove: any, fromIndex?: any) {
            var that = this;
            // if no fromIndex then set to -1, which will refresh everything
            var realFromIndex = (typeof fromIndex === 'number') ? fromIndex : -1;
            rowsToRemove.forEach(function (indexToRemove: any) {
                if (indexToRemove >= realFromIndex) {
                    that.unbindVirtualRow(indexToRemove);

                    // if the row was last to have focus, we remove the fact that it has focus
                    if (that.focusedCell && that.focusedCell.rowIndex == indexToRemove) {
                        that.focusedCell = null;
                    }
                }
            });
        }

        private unbindVirtualRow(indexToRemove: any) {
            var renderedRow = this.renderedRows[indexToRemove];
            renderedRow.destroy();

            var event = {node: renderedRow.getRowNode(), rowIndex: indexToRemove};
            this.eventService.dispatchEvent(Events.EVENT_VIRTUAL_ROW_REMOVED, event);
            this.angularGrid.onVirtualRowRemoved(indexToRemove);

            delete this.renderedRows[indexToRemove];
        }

        public drawVirtualRows() {
            var first: any;
            var last: any;
            var fillinRowsCount = 0;

            var rowCount = this.rowModel.getVirtualRowCount();
            var renderer = this.cellRendererMap['multiline'];
            var mainRowWidth = this.columnModel.getBodyContainerWidth();
            var baseHeight = this.gridOptionsWrapper.getRowHeight();

            if (this.gridOptionsWrapper.isForPrint()) {
                first = 0;
                last = rowCount;
            } else {
                var topPixel = this.eBodyViewport.scrollTop;
                var bottomPixel = topPixel + this.eBodyViewport.offsetHeight;
                var row: RowNode;
                var countRowsBefore = 0;
                var delta = 0;
                var preparedRows:any = {};
                var rowEl: any;

                // if (this.isSingleRow == )
                
                for (var k = 0; k < rowCount; k++) {
                    row = this.rowModel.getVirtualRow(k)
                    if (!row) {
                        break;
                    }
                    
                    // console.log(row);
                    if (!row.group) {
                        delta = row.gridHeight;
                        // if (row.rowHeight === undefined || row.rowHeight === null) {
                        //     rowEl = this.insertRow(row, k, mainRowWidth, baseHeight, countRowsBefore, false);
                        //     row.rowHeight = rowEl.maxRowsNeeded
                        //     preparedRows[k] = rowEl;
                        // }
                        // delta = row.rowHeight;
                    } else {
                        delta = 1;
                    }
                    if ((countRowsBefore + delta) * baseHeight > topPixel) {
                        break;
                    }
                    countRowsBefore += delta;
                }
                first = k;
                for (; k < rowCount; k++) {
                    row = this.rowModel.getVirtualRow(k)
                    if (!row) {
                        break;
                    }

                    if (!row.group) {
                        countRowsBefore += row.gridHeight;
                        // if (row.rowHeight === undefined || row.rowHeight === null) {
                        //     rowEl = this.insertRow(row, k, mainRowWidth, baseHeight, countRowsBefore, false);
                        //     row.rowHeight = rowEl.maxRowsNeeded
                        //     preparedRows[k] = rowEl;
                        // }
                        // countRowsBefore += row.rowHeight;
                    } else {
                        countRowsBefore += 1
                    }
                    if (countRowsBefore * baseHeight > bottomPixel) {
                        break;
                    }
                }
                last = k;

                //add in buffer
                var buffer = this.gridOptionsWrapper.getRowBuffer();
                first = first - buffer;
                last = last + buffer;

                // adjust, in case buffer extended actual size
                if (first < 0) {
                    first = 0;
                }
                if (last > rowCount - 1) {
                    last = rowCount - 1;
                }
            }

            // console.log(first, last);
            this.firstVirtualRenderedRow = first;
            this.lastVirtualRenderedRow = last;

            // this.ensureRowsRendered(preparedRows);
            this.ensureRowsRendered();
        }

        public getFirstVirtualRenderedRow() {
            return this.firstVirtualRenderedRow;
        }

        public getLastVirtualRenderedRow() {
            return this.lastVirtualRenderedRow;
        }

        public countGridRows() {
            var mainRowWidth = this.columnModel.getBodyContainerWidth();
            var baseHeight = this.gridOptionsWrapper.getRowHeight();
            var rowCount: number = this.rowModel.getVirtualRowCount();
            var row: RowNode;
            var rowEl: any;
            for (var k = 0; k < rowCount; k++) {
                row = this.rowModel.getVirtualRow(k);
                if (!row.group) {
                    rowEl = this.insertRow(row, k, mainRowWidth, 0, false);
                    if (rowEl === void 0) throw 'Row is not rendered with id: ' + row.id
                    row.gridHeight = rowEl.maxRowsNeeded;
                } else {
                    row.gridHeight = 1;

                }
            }
        }

        private ensureRowsRendered(preparedRows:any = {}) {

            //var start = new Date().getTime();

            var mainRowWidth = this.columnModel.getBodyContainerWidth();
            var that = this;

            // at the end, this array will contain the items we need to remove
            var rowsToRemove = Object.keys(this.renderedRows);

            var rowsBefore: RowNode[];
            var rowsBeforeCount = 0;
            var baseHeight = this.gridOptionsWrapper.getRowHeight();
            var rowEl: any;
            var delta: number = 0;
            // var heightMult = 3;

            // add in new rows
            rowsBefore = this.rowModel.getVirtualRowsUpto(this.firstVirtualRenderedRow);
            for (var idx = 0; idx < rowsBefore.length; idx++) {
                var row = rowsBefore[idx];
                if (!row.group) {
                    rowsBeforeCount += row.gridHeight;
                } else {
                    rowsBeforeCount += 1;
                }
            }

            for (var rowIndex = this.firstVirtualRenderedRow; rowIndex <= this.lastVirtualRenderedRow; rowIndex++) {
                var node = this.rowModel.getVirtualRow(rowIndex);

                // count how many grid rows take lines above current
                if (node) {
                    if (!node.group) {
                        // debugger;
                        delta = node.gridHeight;
                    } else {
                        // console.log('group row rendered');
                        delta = 1;
                    }
                }
                rowsBeforeCount += delta;

                // see if item already there, and if yes, take it out of the 'to remove' array
                if (rowsToRemove.indexOf(rowIndex.toString()) >= 0) {
                    rowsToRemove.splice(rowsToRemove.indexOf(rowIndex.toString()), 1);
                    continue;
                }

                // check this row actually exists (in case overflow buffer window exceeds real data)
                if (node) {
                    that.insertRow(node, rowIndex, mainRowWidth, rowsBeforeCount-delta);
                }
            }


            // at this point, everything in our 'rowsToRemove' . . .
            this.removeVirtualRow(rowsToRemove);

            // if we are doing angular compiling, then do digest the scope here
            if (this.gridOptionsWrapper.isAngularCompileRows()) {
                // we do it in a timeout, in case we are already in an apply
                setTimeout(function () {
                    that.$scope.$apply();
                }, 0);
            }

            //var end = new Date().getTime();
            //console.log(end-start);
        }

        private insertRow(node: any, rowIndex: any, mainRowWidth: any, rowsBefore: number, realDraw: boolean = true) {
            var columns = this.columnModel.getDisplayedColumns();
            // if no cols, don't draw row
            if (!columns || columns.length == 0) {
                return;
            }

            var renderedRow = new RenderedRow(this.gridOptionsWrapper, this.valueService, this.$scope, this.angularGrid,
                this.columnModel, this.expressionService, this.cellRendererMap, this.selectionRendererFactory,
                this.$compile, this.templateService, this.selectionController, this,
                this.eBodyContainer, this.ePinnedColsContainer, node, rowIndex, this.eventService,
                rowsBefore, realDraw);

            if (realDraw) {
                renderedRow.setMainRowWidth(mainRowWidth);
                this.renderedRows[rowIndex] = renderedRow;
            }

            return renderedRow;
        }

        public getRenderedNodes() {
            var renderedRows = this.renderedRows;
            return Object.keys(renderedRows).map(key => {
                return renderedRows[key].getRowNode();
            });
        }

        public getRenderedRows() {
            return this.renderedRows;
        }

        public setListenMouseMove(toAllSet:boolean = true) {
            var eventAction: Function;
            var allRows = this.renderedRows;
            var el: RenderedRow;
            for (var k in allRows) {
                el = allRows[k];
                eventAction = toAllSet ? el.vBodyRow.addEventListener.bind(el.vBodyRow) : el.vBodyRow.removeEventListener.bind(el.vBodyRow);
                if (toAllSet !== el.isListenForMove()) {
                    eventAction('mousemove', el.listenMoveRef);
                    el.isListenForMove(toAllSet);
                }
            };
        }

        public setHoveredOn(rowNode: any) {
            if (rowNode === null || rowNode === void 0 || !rowNode.node)
                return;
            this.hoveredOn = rowNode.node;
        }

        public getHoveredOn(): any {
            return this.hoveredOn;
        }

        public getIndexOfRenderedNode(node: any): number {
            var renderedRows = this.renderedRows;
            var keys: string[] = Object.keys(renderedRows);
            for (var i = 0; i < keys.length; i++) {
                var key: string = keys[i];
                if (renderedRows[key].getRowNode() === node) {
                    return renderedRows[key].getRowIndex();
                }
            }
            return -1;
        }

        // we use index for rows, but column object for columns, as the next column (by index) might not
        // be visible (header grouping) so it's not reliable, so using the column object instead.
        public navigateToNextCell(key: any, rowIndex: number, column: Column) {

            var cellToFocus = {rowIndex: rowIndex, column: column};
            var renderedRow: RenderedRow;
            var eCell: any;

            // we keep searching for a next cell until we find one. this is how the group rows get skipped
            while (!eCell) {
                cellToFocus = this.getNextCellToFocus(key, cellToFocus);
                // no next cell means we have reached a grid boundary, eg left, right, top or bottom of grid
                if (!cellToFocus) {
                    return;
                }
                // see if the next cell is selectable, if yes, use it, if not, skip it
                renderedRow = this.renderedRows[cellToFocus.rowIndex];
                eCell = renderedRow.getCellForCol(cellToFocus.column);
            }

            // this scrolls the row into view
            this.gridPanel.ensureIndexVisible(renderedRow.getRowIndex());

            // this changes the css on the cell
            this.focusCell(eCell, cellToFocus.rowIndex, cellToFocus.column.index, cellToFocus.column.colDef, true);
        }

        private getNextCellToFocus(key: any, lastCellToFocus: any) {
            var lastRowIndex = lastCellToFocus.rowIndex;
            var lastColumn = lastCellToFocus.column;

            var nextRowToFocus: any;
            var nextColumnToFocus: any;
            switch (key) {
                case Constants.KEY_UP :
                    // if already on top row, do nothing
                    if (lastRowIndex === this.firstVirtualRenderedRow) {
                        return null;
                    }
                    nextRowToFocus = lastRowIndex - 1;
                    nextColumnToFocus = lastColumn;
                    break;
                case Constants.KEY_DOWN :
                    // if already on bottom, do nothing
                    if (lastRowIndex === this.lastVirtualRenderedRow) {
                        return null;
                    }
                    nextRowToFocus = lastRowIndex + 1;
                    nextColumnToFocus = lastColumn;
                    break;
                case Constants.KEY_RIGHT :
                    var colToRight = this.columnModel.getVisibleColAfter(lastColumn);
                    // if already on right, do nothing
                    if (!colToRight) {
                        return null;
                    }
                    nextRowToFocus = lastRowIndex;
                    nextColumnToFocus = colToRight;
                    break;
                case Constants.KEY_LEFT :
                    var colToLeft = this.columnModel.getVisibleColBefore(lastColumn);
                    // if already on left, do nothing
                    if (!colToLeft) {
                        return null;
                    }
                    nextRowToFocus = lastRowIndex;
                    nextColumnToFocus = colToLeft;
                    break;
            }

            return {
                rowIndex: nextRowToFocus,
                column: nextColumnToFocus
            };
        }

        public onRowSelected(rowIndex: number, selected: boolean) {
            if (this.renderedRows[rowIndex]) {
                this.renderedRows[rowIndex].onRowSelected(selected);
            }
        }

        // called by the renderedRow
        public focusCell(eCell: any, rowIndex: number, colIndex: number, colDef: ColDef, forceBrowserFocus: any) {
            // do nothing if cell selection is off
            if (this.gridOptionsWrapper.isSuppressCellSelection()) {
                return;
            }

            this.eParentsOfRows.forEach( function(rowContainer: HTMLElement) {
                // remove any previous focus
                _.querySelectorAll_replaceCssClass(rowContainer, '.ag-cell-focus', 'ag-cell-focus', 'ag-cell-no-focus');

                var selectorForCell = '[row="' + rowIndex + '"] [col="' + colIndex + '"]';
                _.querySelectorAll_replaceCssClass(rowContainer, selectorForCell, 'ag-cell-no-focus', 'ag-cell-focus');
            });

            this.focusedCell = {rowIndex: rowIndex, colIndex: colIndex, node: this.rowModel.getVirtualRow(rowIndex), colDef: colDef};

            // this puts the browser focus on the cell (so it gets key presses)
            if (forceBrowserFocus) {
                eCell.focus();
            }

            this.eventService.dispatchEvent(Events.EVENT_CELL_FOCUSED, this.focusedCell);
        }

        // for API
        public getFocusedCell() {
            return this.focusedCell;
        }

        // called via API
        public setFocusedCell(rowIndex: any, colIndex: any) {
            var renderedRow = this.renderedRows[rowIndex];
            var column = this.columnModel.getDisplayedColumns()[colIndex];
            if (renderedRow && column) {
                var eCell = renderedRow.getCellForCol(column);
                this.focusCell(eCell, rowIndex, colIndex, column.colDef, true);
            }
        }

        // called by the cell, when tab is pressed while editing
        public startEditingNextCell(rowIndex: any, column: any, shiftKey: any) {

            var firstRowToCheck = this.firstVirtualRenderedRow;
            var lastRowToCheck = this.lastVirtualRenderedRow;
            var currentRowIndex = rowIndex;

            var visibleColumns = this.columnModel.getDisplayedColumns();
            var currentCol = column;

            while (true) {

                var indexOfCurrentCol = visibleColumns.indexOf(currentCol);

                // move backward
                if (shiftKey) {
                    // move along to the previous cell
                    currentCol = visibleColumns[indexOfCurrentCol - 1];
                    // check if end of the row, and if so, go back a row
                    if (!currentCol) {
                        currentCol = visibleColumns[visibleColumns.length - 1];
                        currentRowIndex--;
                    }

                    // if got to end of rendered rows, then quit looking
                    if (currentRowIndex < firstRowToCheck) {
                        return;
                    }
                    // move forward
                } else {
                    // move along to the next cell
                    currentCol = visibleColumns[indexOfCurrentCol + 1];
                    // check if end of the row, and if so, go forward a row
                    if (!currentCol) {
                        currentCol = visibleColumns[0];
                        currentRowIndex++;
                    }

                    // if got to end of rendered rows, then quit looking
                    if (currentRowIndex > lastRowToCheck) {
                        return;
                    }
                }

                var nextRenderedRow: RenderedRow = this.renderedRows[currentRowIndex];
                var nextRenderedCell: RenderedCell = nextRenderedRow.getRenderedCellForColumn(currentCol);
                if (nextRenderedCell.isCellEditable()) {
                    nextRenderedCell.startEditing();
                    nextRenderedCell.focusCell(false);
                    return;
                }
            }
        }
    }
}
