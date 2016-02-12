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
        private numberOfLinesCalculated: number;
        private beforeCalculatedHeight: number;
        private afterCalculatedHeight: number;
        private renderedTotalHeight: number;
        private renderedAverageHeight: number;
        private heightFromLastRow: number;

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
            this.numberOfLinesCalculated = 0;
            this.beforeCalculatedHeight = 0;
            this.afterCalculatedHeight = 0;
            this.renderedTotalHeight = 0;
            this.heightFromLastRow = 0;

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

            var maxRows: number = this.gridOptionsWrapper.getMaxRows();
            var minRows: number = this.gridOptionsWrapper.getMinRows();
            this.renderedAverageHeight = (maxRows + minRows) / 2;
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
            this.refreshView();
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
            this.refreshAllVirtualRows(refreshFromIndex);
            if (!this.gridOptionsWrapper.isForPrint()) {
                // var rowCount = this.rowModel.getGridRowCount();
                // var containerHeight = this.gridOptionsWrapper.getRowHeight() * rowCount;
                // var containerHeight = this.gridOptionsWrapper.getRowHeight() * this.numberOfLinesCalculated;
                var containerHeight = this.getBodyHeight();

                this.eBodyContainer.style.height = containerHeight + "px";
                // this.gridPanel.getLayout().setRowOverlayRowHeight(this.eBodyContainer.style.height);

                this.ePinnedColsContainer.style.height = containerHeight + "px";
            }

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
            // this.countGridRows();
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


        /***********************************************
        * START of ROW RENDERING
        ************************************************/
        public drawVirtualRows() {
            var first: any;
            var last: any;
            // var fillinRowsCount = 0;

            var rowCount = this.rowModel.getVirtualRowCount();
            var baseHeight = this.gridOptionsWrapper.getRowHeight();
            var maxRows: number = this.gridOptionsWrapper.gridOptions.maxRows;
            var minRows: number = this.gridOptionsWrapper.gridOptions.minRows;
            var topPixel = this.eBodyViewport.scrollTop;
            var bottomPixel = topPixel + this.eBodyViewport.offsetHeight;
            var buffer = this.gridOptionsWrapper.getRowBuffer();
            var groupKeys = this.gridOptionsWrapper.getGroupKeys();
            var isGroup = groupKeys ? groupKeys.length : groupKeys;
            var countLinesBefore = 0;

            var verticalGap = 15; // top/bottom padding + borders (px) default: 15

            if (this.gridOptionsWrapper.isForPrint()) {
                first = 0;
                last = rowCount;
            } else if (maxRows === void 0 || minRows === void 0) {
                first = 0;
                last = rowCount;
                // } else if (maxRows === minRows && !isGroup) {
            } else {
                // first = Math.floor(    topPixel / ((baseHeight - verticalGap) * minRows + verticalGap) );
                // last = Math.floor(  bottomPixel / ((baseHeight - verticalGap) * minRows + verticalGap) );
                first = Math.floor(topPixel / ((baseHeight - verticalGap) * minRows + verticalGap));
                last = Math.floor(bottomPixel / baseHeight);

                first = first - buffer;
                last = last + buffer;
                if (first < 0) {
                    first = 0;
                }
                if (last > rowCount - 1) {
                    last = rowCount - 1;
                }
            }
            //     var preRows = this.rowModel.getVirtualRowsUpto()
            //     first = Math.trunc(topPixel / (baseHeight * maxRows));
            //     last = Math.trunc(bottomPixel / (baseHeight * maxRows));;

            //     first = first - buffer;
            //     last = last + buffer;
            //     if (first < 0) {
            //         first = 0;
            //     }
            //     if (last > rowCount - 1) {
            //         last = rowCount - 1;
            //     }

            // } else {
            // } else if (maxRows === minRows && isGroup) {
            //     var row: RowNode;
            //     var countRowsBefore = 0;
            //     var delta = 0;
            //     var deltaHistory = [];
            //     var preparedRows:any = {};
            //     var rowEl: any;

            //     for (var k = 0; k < rowCount; k++) {
            //         row = this.rowModel.getVirtualRow(k)
            //         if (!row) {
            //             break;
            //         }
                    
            //         if (!row.group) {
            //             delta = maxRows;
            //         } else {
            //             delta = 1;
            //         }
            //         if ((countRowsBefore + delta) * baseHeight > topPixel) {
            //             break;
            //         }
            //         deltaHistory.push(delta);
            //         countRowsBefore += delta;
            //     }
            //     first = k;
            //     countLinesBefore = countRowsBefore;
            //     for (; k < rowCount; k++) {
            //         row = this.rowModel.getVirtualRow(k)
            //         if (!row) {
            //             break;
            //         }

            //         if (!row.group) {
            //             delta = maxRows;
            //         } else {
            //             delta = 1
            //         }
            //         if ((countRowsBefore + delta) * baseHeight > bottomPixel) {
            //             break;
            //         }
            //         countRowsBefore += delta;
            //     }
            //     last = k;

            //     //add in buffer
            //     first = first - buffer;
            //     last = last + buffer;
            //     countLinesBefore = deltaHistory.slice(0, -buffer).reduce(function(acc, el) { return acc + el;}, 0);

            //     // adjust, in case buffer extended actual size
            //     if (first < 0) {
            //         countLinesBefore = 0;
            //         first = 0;
            //     }
            //     if (last > rowCount - 1) {
            //         last = rowCount - 1;
            //     }
            // } else {
            //     first = 0;
            //     last = 10;
            // }

            this.firstVirtualRenderedRow = first;
            this.lastVirtualRenderedRow = last;

            // console.log(first, last);
            // this.ensureRowsRendered(preparedRows);
            this.ensureRowsRendered(countLinesBefore);
        }

        public getFirstVirtualRenderedRow() {
            return this.firstVirtualRenderedRow;
        }

        public getLastVirtualRenderedRow() {
            return this.lastVirtualRenderedRow;
        }

        private ensureRowsRendered(countLinesBefore:number = 0) {
            var that = this;

            // at the end, this array will contain the items we need to remove
            var rowsToRemove = Object.keys(this.renderedRows);

            var totalRows = this.rowModel.getVirtualRowCount();
            var maxRows: number = this.gridOptionsWrapper.getMaxRows();
            var minRows: number = this.gridOptionsWrapper.getMinRows();
            var mainRowWidth = this.columnModel.getBodyContainerWidth();

            var linesBeforeCount = 0;
            var linesBeforePlusRenderedCount = 0;
            var linesRenderedCount = 0;
            var rowsAfterCount = 0;
            var rowsBeforeCount = 0;
            var rowsRenderedCount = 0;
            var linesAfterCount = 0;
            var linesPerRowInRendered = 0;
            var linesPerRow = maxRows;
            if (maxRows !== minRows) {
                linesPerRow = (maxRows + minRows) / 2;
            }

            var baseHeight = this.gridOptionsWrapper.getRowHeight();
            var verticalGap = 15; // top/bottom padding + borders (px) default: 15

            var timing = 0;
            var timingReflow = 0;

            // debugger;
            // console.log(this.firstVirtualRenderedRow, Math.min.apply(null, rowsToRemove));

            rowsBeforeCount = this.firstVirtualRenderedRow;
            linesBeforeCount = countLinesBefore || Math.round(rowsBeforeCount * linesPerRow);
            linesBeforePlusRenderedCount = linesBeforeCount;
            rowsRenderedCount = this.lastVirtualRenderedRow - rowsBeforeCount + 1;

            var rowKeys = Object.keys(this.renderedRows);
            var topPx = this.renderedAverageHeight * rowsBeforeCount;
            // add in new rows
            var direction = 1;
            var fromIdx = this.firstVirtualRenderedRow;
            var toIdx = this.lastVirtualRenderedRow;
            // debugger;
            if ( (this.firstVirtualRenderedRow || 0) < Math.min.apply(null, rowsToRemove.length ? rowsToRemove : [0])) {
                direction = -1;
                fromIdx = this.lastVirtualRenderedRow;
                toIdx = this.firstVirtualRenderedRow;
            }
            for (var rowIndex = fromIdx; direction > 0 ? rowIndex <= toIdx : rowIndex >= toIdx; rowIndex += direction) {
                var node = this.rowModel.getVirtualRow(rowIndex);

                // see if item already there, and if yes, take it out of the 'to remove' array
                if (rowsToRemove.indexOf(rowIndex.toString()) >= 0) {
                    rowsToRemove.splice(rowsToRemove.indexOf(rowIndex.toString()), 1);
                    // linesBeforePlusRenderedCount += this.renderedRows[rowIndex.toString()].getHeight() / baseHeight;
                    linesBeforePlusRenderedCount += maxRows;
                    topPx += this.renderedRows[rowIndex].getHeight();
                    continue;
                }

                // if (rowIndex == 13) {
                // }
                // console.log(rowIndex, linesBeforePlusRenderedCount);

                // check this row actually exists (in case overflow buffer window exceeds real data)
                if (node) {
                    var rowRenderedBefore = this.renderedRows[rowIndex - 1];
                    var rowRenderedAfter = this.renderedRows[rowIndex + 1];
                    if (rowRenderedBefore) {
                        topPx = rowRenderedBefore.getVerticalFrame().bottom;
                    } else if (rowRenderedAfter) {
                        topPx = rowRenderedAfter.getVerticalFrame().top;
                    } else {
                        topPx = 0;
                    }
                    var insertedRow = this.insertRow(node, rowIndex, mainRowWidth, linesBeforePlusRenderedCount, topPx);
                    if (rowRenderedAfter) {
                        insertedRow.positionTop(topPx - insertedRow.getHeight())
                    }
                    // linesBeforePlusRenderedCount += insertedRow.getHeight() / baseHeight;
                    linesBeforePlusRenderedCount += maxRows;
                    topPx += insertedRow.getHeight();

                    timing += insertedRow.timing;
                    timingReflow += insertedRow.timingReflow;

                }
            }


            linesRenderedCount = linesBeforePlusRenderedCount - linesBeforeCount;
            rowsAfterCount = totalRows - rowsBeforeCount - rowsRenderedCount;
            linesPerRowInRendered = linesRenderedCount / rowsRenderedCount;
            linesAfterCount = rowsAfterCount * linesPerRowInRendered;

            this.numberOfLinesCalculated = linesBeforeCount + linesRenderedCount + linesAfterCount;

            
            rowKeys = Object.keys(this.renderedRows);
            var lastRenderedIndex = Math.max.apply(null, rowKeys);
            if (lastRenderedIndex + 1 == totalRows) {
                var lastRow = this.renderedRows[lastRenderedIndex];
                this.heightFromLastRow = lastRow.getVerticalFrame().bottom;
                // this.refreshView();
                this.eBodyContainer.style.height = this.heightFromLastRow + "px";
                this.ePinnedColsContainer.style.height = this.heightFromLastRow + "px";
            } else {
                this.heightFromLastRow = 0;
            }
            if (rowKeys.length) {
                this.renderedTotalHeight = rowKeys.map((k) => { return this.renderedRows[k]; }).reduce((acc, el) => {
                    return acc + parseInt(el.getHeight());
                }, 0);
            }
            this.renderedAverageHeight = this.renderedTotalHeight / rowKeys.length;
            rowsBeforeCount = Math.min.apply(this, rowKeys)
            this.beforeCalculatedHeight = this.renderedAverageHeight * rowsBeforeCount;
            rowsAfterCount = totalRows - rowKeys.length - rowsBeforeCount;
            this.afterCalculatedHeight = this.renderedAverageHeight * rowsAfterCount; 
            // console.log(renderedAverageHeight, this.renderedTotalHeight, this.beforeCalculatedHeight, this.afterCalculatedHeight);
            // console.log(this.renderedTotalHeight + this.beforeCalculatedHeight + this.afterCalculatedHeight);
            

            // console.log('Total time taken for lines rendering (ms): ', timing);
            // console.log('Including lines reflow (ms): ', timingReflow);

            // at this point, everything in our 'rowsToRemove' . . .
            this.removeVirtualRow(rowsToRemove);


            // if we are doing angular compiling, then do digest the scope here
            if (this.gridOptionsWrapper.isAngularCompileRows()) {
                // we do it in a timeout, in case we are already in an apply
                setTimeout(function () {
                    that.$scope.$apply();
                }, 0);
            }

        }

        public getBodyHeight(): number {
            return this.heightFromLastRow || (this.beforeCalculatedHeight + this.renderedTotalHeight + this.afterCalculatedHeight);
        }

        private insertRow(node: any, rowIndex: any, mainRowWidth: any, rowsBefore: number, topPx: number, realDraw: boolean = true) {
            var columns = this.columnModel.getDisplayedColumns();
            // if no cols, don't draw row
            if (!columns || columns.length == 0) {
                return;
            }

            var renderedRow = new RenderedRow(this.gridOptionsWrapper, this.valueService, this.$scope, this.angularGrid,
                this.columnModel, this.expressionService, this.cellRendererMap, this.selectionRendererFactory,
                this.$compile, this.templateService, this.selectionController, this,
                this.eBodyContainer, this.ePinnedColsContainer, node, rowIndex, this.eventService,
                rowsBefore, topPx, realDraw);

            if (realDraw) {
                renderedRow.setMainRowWidth(mainRowWidth);
                this.renderedRows[rowIndex] = renderedRow;

                debugger;
                var dragHandler = renderedRow.vBodyRow.element.querySelector('.ag-js-draghandler');
                // if (this.headerElements.drag) {
                if (dragHandler) this.setupDND(dragHandler);
                // } else {
                //     dragHandler.classList.remove('ag-js-draghandler');
                // }
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

        /***********************************************
        * END of ROW RENDERING
        ************************************************/
        /***********************************************
        * DND BLOCK
        ************************************************/
        private canDrop(providedAttrs?: any): boolean {
            return true;
        }

        private getDragSource(): any {
            // drag source is a single element with 'dragging' class
            var sourceEl = this.eBodyContainer.querySelector('.ag-dragging');
            var sourceId = sourceEl.getAttribute('row');
            var draggingRowObject: any = this.rowModel.getVirtualRow(sourceId);

            return draggingRowObject;
        }

        private setupDND(dragHandler: Element) {
            var that = this;
            dragHandler.setAttribute('draggable', 'true');

            // start/stop dragging header
            dragHandler.addEventListener('dragstart', function(event: DragEvent) {
                var rowEl = dragHandler;
                while (!rowEl.classList.contains('ag-row') && rowEl.parentElement) {
                    rowEl = rowEl.parentElement;
                }
                rowEl.classList.add('ag-dragging');
                // if (that.eHeaderCell.parentElement.classList.contains('ag-header-group-cell-with-group')) {
                //     that.eHeaderCell.parentElement.parentElement.classList.add('ag-dragging');
                // } else {
                //     that.eHeaderCell.classList.add('ag-dragging');
                // }
                event.dataTransfer.setData('text', rowEl.getAttribute('row'));
            });
            dragHandler.addEventListener('dragover', function(event: DragEvent) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                // if (that.canDrop()) {
                //     event.dataTransfer.dropEffect = 'move';
                // } else {
                //     event.dataTransfer.dropEffect = 'none';
                // }
            });
            dragHandler.addEventListener('dragend', function() {
                var draggingElement = that.eBodyContainer.querySelector('.ag-dragging');
                if (draggingElement) {
                    draggingElement.classList.remove('ag-dragging');
                }

                clearAllDragStyles();
            });

            // react to drag header over header
            var lastenter: any;

            var clearAllDragStyles = () => {
                var stylesToClear: string[] = ['ag-dragging-over', 'ag-dragging-over-up', 'ag-dragging-over-down'];
                stylesToClear.forEach((styleName: string) => {
                    Array.prototype.forEach.call(this.eBodyContainer.querySelectorAll('.' + styleName), (element: HTMLElement) => {
                        element.classList.remove(styleName);
                    });
                });
            }

            var dragEnterHandler = (event: DragEvent) => {

                var attrs = that.detectDragParties();
                var canDrop = that.canDrop(attrs);
                var isDirectionRight = attrs.sourceAttrs.colStartIndex < attrs.destAttrs.colStartIndex
                var host: Element;
                var neighbour: Element;

                if (
                    !lastenter &&
                    !that.eHeaderCell.classList.contains('ag-dragging-over') &&
                    canDrop
                ) {
                    // debugger;
                    clearAllDragStyles();
                    // console.log(that.eHeaderCell);
                    if (that.eHeaderCell.parentElement.classList.contains('ag-header-group-cell-with-group')) {
                        host = that.eHeaderCell.parentElement.parentElement;
                        neighbour = isDirectionRight ? that.eHeaderCell.parentElement.parentElement.nextElementSibling : that.eHeaderCell.parentElement.parentElement.previousElementSibling;
                    } else if (that.eHeaderCell.classList.contains('ag-header-cell-grouped')) {
                        host = that.eHeaderCell;
                        neighbour = isDirectionRight ? that.eHeaderCell.parentElement.nextElementSibling : that.eHeaderCell.parentElement.previousElementSibling;
                    } else {
                        host = that.eHeaderCell;
                        neighbour = isDirectionRight ? that.eHeaderCell.parentElement.nextElementSibling : that.eHeaderCell.parentElement.previousElementSibling;
                    }

                    host.classList.add('ag-dragging-over');
                    host.classList.add(
                        isDirectionRight ? 'ag-dragging-over-right' : 'ag-dragging-over-left'
                    );

                    if (neighbour) {
                        if (neighbour.firstElementChild.classList.contains('ag-header-group-cell-with-group')) {
                            
                            // console.log('bracket neighbour');
                            neighbour.classList.add(
                                !isDirectionRight ? 'ag-dragging-over-right' : 'ag-dragging-over-left'
                            );
                        } else {
                            // console.log('header neighbour');
                            neighbour.firstElementChild.classList.add(
                                !isDirectionRight ? 'ag-dragging-over-right' : 'ag-dragging-over-left'
                            );
                        }
                    }
                }

                lastenter = event.target;
                event.stopPropagation();
                event.preventDefault();
                return false;
            };
            var dragLeaveHandler = (event: Event) => {
                var styleName = 'ag-dragging-over';
                var hostId = that.getGui().getAttribute('colId');
                if (!hostId) {
                    hostId = that.getGui().querySelector('.ag-header-group-cell-with-group').getAttribute('colId');
                }
                if (lastenter === event.target) {
                    var othersDragging = Array.prototype.filter.call(this.eRootRef.querySelectorAll('.' + styleName), (element: HTMLElement) => {
                        return element.getAttribute('colId') !== hostId;
                    });
                    if (!othersDragging.length) {
                        clearAllDragStyles();
                    }

                    lastenter = null;
                }
            };
            this.eHeaderCell.addEventListener('dragenter', dragEnterHandler);
            this.eHeaderCell.addEventListener('dragleave', dragLeaveHandler);

            // swap columns on drop
            this.eHeaderCell.addEventListener('drop', function(event: DragEvent) {
                var freezeIndex = that.columnController.getPinnedColumnCount();
                var dragData = event.dataTransfer.getData('text');
                var srcColumn = that.columnController.getColumn(dragData);
                if (!srcColumn) {
                    srcColumn = that.columnController.getColumnGroup(dragData).bracketHeader.column
                }
                var srcColumnAttrs = that.detectDragParty(srcColumn);
                var destColumn = that.column
                var destColumnAttrs = that.detectDragParty(destColumn);

                var directionRight = srcColumnAttrs.colStartIndex < destColumnAttrs.colStartIndex
                var toIdx = directionRight ? destColumnAttrs.colEndIndex : destColumnAttrs.colStartIndex;
                var fromIdx = srcColumnAttrs.colStartIndex;

                var dSrc = srcColumnAttrs.colStartIndex < freezeIndex ? freezeIndex - srcColumnAttrs.colStartIndex : srcColumnAttrs.colStartIndex - freezeIndex + 1;
                var dDest = destColumnAttrs.colStartIndex < freezeIndex ? freezeIndex - destColumnAttrs.colStartIndex : destColumnAttrs.colStartIndex - freezeIndex + 1;
                var dSrcDest = Math.abs(destColumnAttrs.colStartIndex - srcColumnAttrs.colStartIndex) + 1;

                var srcBracketSize = srcColumn.colDef.columnGroup ? srcColumn.colDef.columnGroup.displayedColumns.length - 1 : 0;
                var isCrossBorder = dSrc + dDest == dSrcDest;
                var bracketShiftCompensation = 0;

                if (isCrossBorder) {
                    var lastInFridge = that.eRootRef.querySelector('.ag-pinned-header').lastElementChild;
                    if (!directionRight && lastInFridge.firstElementChild.classList.contains('ag-header-group-cell')) {
                        bracketShiftCompensation = -lastInFridge.querySelectorAll('.ag-header-cell').length + 1;
                    }
                    var firstInRiver = that.eRootRef.querySelector('.ag-header-container').firstElementChild;
                    if (directionRight && firstInRiver.firstElementChild.classList.contains('ag-header-group-cell')) {
                        bracketShiftCompensation = firstInRiver.querySelectorAll('.ag-header-cell').length - 1;
                    }
                    that.columnController.setPinnedColumnCount(freezeIndex + srcBracketSize * (directionRight ? -1 : 1) + bracketShiftCompensation);
                }

                for (var idx = 0; idx < srcColumnAttrs.colEndIndex - srcColumnAttrs.colStartIndex + 1; idx++) {
                    // fetch indexes from all columns for visible ones as moveColumn works with all cilomns list
                    var fromIdxInAll = that.columnController.getAllColumns().indexOf(that.columnController.getDisplayedColumns()[fromIdx]);
                    var toIdxInAll = that.columnController.getAllColumns().indexOf(that.columnController.getDisplayedColumns()[toIdx]);
                    that.columnController.moveColumn(fromIdxInAll, toIdxInAll);
                    if (!directionRight) {
                        toIdx++;
                        fromIdx++;
                    }
                }

                event.stopPropagation();
                event.preventDefault();
                return false;
            });
        }

        /***********************************************
        * END of DND BLOCK
        ************************************************/

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
