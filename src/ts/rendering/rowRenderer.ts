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
        public isListenMouseMove: boolean;
        private isSingleRow: boolean;
        private numberOfLinesCalculated: number;
        private beforeCalculatedHeight: number;
        private afterCalculatedHeight: number;
        private renderedTotalHeight: number;
        private renderedAverageHeight: number;
        private heightFromLastRow: number;
        private previousRowIndex: number;
        private prePreviousRowIndex: number;

        private maxOrderColumnWidth: number;
        private orderColumn: Column;
        private canOrderResize: boolean;


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
            this.isListenMouseMove = false;
            this.isSingleRow = true;
            this.numberOfLinesCalculated = 0;
            this.beforeCalculatedHeight = 0;
            this.afterCalculatedHeight = 0;
            this.renderedTotalHeight = 0;
            this.heightFromLastRow = 0;

            this.previousRowIndex = null;
            this.prePreviousRowIndex = null;
            
            this.maxOrderColumnWidth = null;
            this.orderColumn = null;
            this.canOrderResize = true;

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
            this.canOrderResize = false;
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
            this.canOrderResize = true;
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

            this.maxOrderColumnWidth = 0;

            this.orderColumn = this.columnModel.getColumn('order');

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
            var assumedRowHeghtPx = (baseHeight - verticalGap) * minRows + verticalGap;

            var timing = 0;
            var timingReflow = 0;

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
            if ( (this.firstVirtualRenderedRow || 0) < Math.min.apply(null, rowsToRemove.length ? rowsToRemove : [0])) {
                direction = -1;
                fromIdx = this.lastVirtualRenderedRow;
                toIdx = this.firstVirtualRenderedRow;
            }
            for (var rowIndex = fromIdx; direction > 0 ? rowIndex <= toIdx : rowIndex >= toIdx; rowIndex += direction) {
                var node = this.rowModel.getVirtualRow(rowIndex);

                var curIsStructure: Boolean = false;
                if (node.data && node.data.type == 'structure') {
                    curIsStructure = true;
                }

                var prevRow;
                if (rowIndex && curIsStructure) {
                    prevRow = this.renderedRows[rowIndex - 1];
                    if (prevRow) {
                        prevRow.vBodyRow.addClass('ag-structure-end');
                        if (prevRow.vPinnedRow) {
                            prevRow.vPinnedRow.addClass('ag-structure-end');
                        }
                    }
                }

                // see if item already there, and if yes, take it out of the 'to remove' array
                if (rowsToRemove.indexOf(rowIndex.toString()) >= 0) {
                    rowsToRemove.splice(rowsToRemove.indexOf(rowIndex.toString()), 1);
                    // linesBeforePlusRenderedCount += this.renderedRows[rowIndex.toString()].getHeight() / baseHeight;
                    linesBeforePlusRenderedCount += maxRows;
                    topPx += this.renderedRows[rowIndex].getHeight();
                    continue;
                }


                // check this row actually exists (in case overflow buffer window exceeds real data)
                if (node) {
                    var rowRenderedBefore = this.renderedRows[rowIndex - 1];
                    var rowRenderedAfter = this.renderedRows[rowIndex + 1];
                    if (rowRenderedBefore) {
                        topPx = rowRenderedBefore.getVerticalFrame().bottom;
                    } else if (rowRenderedAfter) {
                        // console.log('row', rowRenderedAfter);
                        // console.log('row frame', rowRenderedAfter.getVerticalFrame());
                        topPx = rowRenderedAfter.getVerticalFrame().top;
                    } else {
                        topPx = rowIndex * assumedRowHeghtPx;
                    }
                    var insertedRow = this.insertRow(node, rowIndex, mainRowWidth, linesBeforePlusRenderedCount, topPx);
                    if ((insertedRow.rowIndex + 1) == totalRows) {
                        insertedRow.vBodyRow.addClass('ag-structure-end');
                        if (insertedRow.vPinnedRow) {
                            insertedRow.vPinnedRow.addClass('ag-structure-end');
                        }
                    }
                    if (curIsStructure) {
                        insertedRow.vBodyRow.addClass('ag-structure-start')
                        if (insertedRow.vPinnedRow) {
                            insertedRow.vPinnedRow.addClass('ag-structure-start');
                        }
                    }
                    // if (rowIndex < 1) {
                    //     console.log(rowIndex, topPx);
                    // }
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
            var orderCellEl: HTMLElement;
            var orderCellElContainer: HTMLElement;
            var orderCellElShift: HTMLElement;
            var orderCellElNumber: HTMLElement;
            var orderCellElArrow: HTMLElement;

            var orderCellElShiftWidth: number;
            var orderCellElNumberWidth: number;
            var orderCellElArrowWidth: number;
            var orderCellLeftPadding: number;
            var orderCellRightPadding: number;
            var currentWidth: number;
            var orderedCell: RenderedCell;

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
                renderedRow.setMainRowWidth(mainRowWidth + this.gridOptionsWrapper.getExtraRowWidth());
                this.renderedRows[rowIndex] = renderedRow;

                if (this.orderColumn) {
                    orderedCell = renderedRow.renderedCells[this.orderColumn.index];
                    if (orderedCell) orderCellEl = orderedCell.vGridCell.element;
                }
                if (orderCellEl) {
                    orderCellElContainer = <HTMLElement>orderCellEl.querySelector('.pi-table');

                    orderCellElShift = <HTMLElement>orderCellElContainer.querySelector('span');
                    orderCellElNumber = <HTMLElement>orderCellElContainer.querySelector('.ag-group-name');
                    if (!orderCellElNumber) {
                        orderCellElNumber = <HTMLElement>orderCellElContainer.querySelector('.ag-group-parent-name');
                    }
                    orderCellElArrow = <HTMLElement>orderCellElContainer.querySelector('.group-expand-control');

                    orderCellElShiftWidth = orderCellElShift ? orderCellElShift.offsetWidth : 0;
                    orderCellElNumberWidth = orderCellElNumber ? orderCellElNumber.offsetWidth : 0;
                    orderCellElArrowWidth = orderCellElArrow ? orderCellElArrow.offsetWidth : 0;
                    orderCellLeftPadding = parseInt(
                        window.getComputedStyle(orderCellEl, null).getPropertyValue('padding-left')
                    ) || 0;
                    orderCellRightPadding = parseInt(
                        window.getComputedStyle(orderCellEl, null).getPropertyValue('padding-right')
                    ) || 0;

                    currentWidth = (
                        orderCellLeftPadding +
                        orderCellElShiftWidth + orderCellElNumberWidth + orderCellElArrowWidth +
                        orderCellRightPadding
                    );

                    this.maxOrderColumnWidth = Math.max(
                        currentWidth,
                        this.maxOrderColumnWidth
                    );
                }

                this.setupDND(renderedRow);
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
        private isParentByIndex(parentOrderIndex: string, childOrderIndex: string) {
            return !!~childOrderIndex.search(
                new RegExp('^' + parentOrderIndex.replace('\.', '\\.'))
            );
        }

        private getOrderIndex(rowIndex: number|string): string {
            return this.getRenderedRows()[rowIndex].getNode().data.order.orderNumber;
        }

        private getSourceOrderIndex(): string {
            return this.rowModel.getDragSource();
        }
        
        private canDrop(sourceOrderIndex: string, destOrderIndex: string, target: HTMLElement, isTargetAdd: boolean = false): boolean {
            let targetIsAdd = isTargetAdd || (
                    target.classList.contains('ag-group-name') ||
                    target.classList.contains('ag-group-parent-name')
                );

            let isDrop = this.gridOptionsWrapper.isRowDrop({
                sourceOrderIndex: sourceOrderIndex,
                destOrderIndex: destOrderIndex,
                isAdd: targetIsAdd
            });
            isDrop = (isDrop === void 0) ? true : isDrop;
                
            return !this.isParentByIndex(sourceOrderIndex, destOrderIndex) && isDrop;
        }

        private findParentRow(startEl: Element): Element {
            var rowEl = startEl;
            while (!rowEl.classList.contains('ag-row') && rowEl.parentElement) {
                rowEl = rowEl.parentElement;
            }
            return rowEl;
        }

        // private draggingNodeInfo(el: Element): any {
        //     var rowObj = this.renderedRows[el.getAttribute('row')];
        //     var rowNode = rowObj.node;
        //     var lvl = (rowNode.data.order.orderNumber.match(/\./g) || []).length
        //     var isParent = rowNode.data.order.isParent;
        //     while (rowNode.parent && rowNode.level != lvl) {
        //         rowNode = rowNode.parent;
        //     }
        //     return {
        //         row: rowObj,
        //         level: lvl,
        //         parentId: rowNode.parent ? rowNode.parent.id : 0,
        //         hasChildren: isParent
        //     };
        // }

        private setupDND(thisRow: RenderedRow) {
            var that = this;
            var thisRowIndex = thisRow.getRowIndex()
            // react to drag header over header
            var lastenter: any;

            var ePinRow = thisRow.vPinnedRow ? thisRow.vPinnedRow.element : null;
            var eBodyRow = thisRow.vBodyRow.element;

            function getMousePoint(event: DragEvent) {
                return event.pageY - (<HTMLElement>event.currentTarget).getBoundingClientRect().top;
            }

            function isUpperPart(event: DragEvent) {
                let upperPoint = (<HTMLElement>event.currentTarget).offsetHeight / 3;
                return upperPoint > getMousePoint(event);
            }

            function isLowerPart(event: DragEvent) {
                let lowerPoint = 2 * (<HTMLElement>event.currentTarget).offsetHeight / 3;
                return lowerPoint < getMousePoint(event);
            }

            function isMiddlePart(event: DragEvent) {
                return !(isLowerPart(event) || isUpperPart(event));
            }

            let [dragHandlers, dragTargets] = ['ag-js-draghandler', 'ag-js-dragtarget'].map((styleName)=>{
                return (ePinRow ? [].slice.call(ePinRow.querySelectorAll('.' + styleName)) : []).concat(
                    (ePinRow ? ePinRow.classList.contains(styleName) : false) ? ePinRow : []
                ).concat(
                    [].slice.call(eBodyRow.querySelectorAll('.' + styleName))
                ).concat(
                    eBodyRow.classList.contains(styleName) ? eBodyRow : []
                )
            });
            if (!dragHandlers || !dragHandlers.length) return;

            for (let dragEl of dragHandlers) {
                dragEl.setAttribute('draggable', 'true');
                dragEl.addEventListener('dragstart', (function(curDragEl) {
                    return function(ev: DragEvent) {
                        onDragStart(ev, curDragEl);
                    }
                })(dragEl));
                dragEl.addEventListener('dragover', onDragOver);
                dragEl.addEventListener('dragend', onDragEnd);
                dragEl.addEventListener('dragenter', (function(curDragEl) {
                    return function(ev: DragEvent) {
                        onDragEnter(ev, curDragEl);
                    }
                })(dragEl));
                dragEl.addEventListener('dragleave', (function(curDragEl) {
                    return function(ev: DragEvent) {
                        onDragLeave(ev, curDragEl);
                    }
                })(dragEl));
                dragEl.addEventListener('drop', function(ev: DragEvent) {
                    onDragDrop(
                        ev,
                        isMiddlePart(ev) ? 'inside' : 'level'
                    );
                });
            }


            for (let dragEl of dragTargets) {
                dragEl.addEventListener('dragover', onDragOver);
                dragEl.addEventListener('drop', function(ev: DragEvent) {
                    onDragDrop(ev, 'inside');
                });
            }

            // function isLowerHalf(event: DragEvent) {
            //     return (
            //         ((<HTMLElement>event.currentTarget).offsetHeight / 2) <
            //         (event.pageY - (<HTMLElement>event.currentTarget).getBoundingClientRect().top)
            //     );
            // }


            function clearAllDragStyles() {
                var stylesToClear: string[] = ['ag-dragging-over', 'ag-dragging-over-up', 'ag-dragging-over-down'];
                var rowContainersToClear: HTMLElement[] = [that.eBodyContainer, that.ePinnedColsContainer];
                stylesToClear.forEach((styleName: string) => {
                    rowContainersToClear.forEach((eRowContainer: HTMLElement) => {
                        Array.prototype.forEach.call(eRowContainer.querySelectorAll('.' + styleName), (element: HTMLElement) => {
                            element.classList.remove(styleName);
                        });
                    });
                });
            }

            function onDragStart(event: DragEvent, dragHandler: Element) {
                var rowEl = that.findParentRow(dragHandler);
                rowEl.classList.add('ag-dragging');
                var rowIndex = rowEl.getAttribute('row')
                event.dataTransfer.setData('text', rowIndex);
                // event.dataTransfer.effectAllowed('all');
                // store node data as it can be in not rendered state when drag is dropped (went out of visual scope)
                that.rowModel.setDragSource(that.getRenderedRows()[rowIndex].getNode().data.order.orderNumber)
            }

            function onDragOver(event: DragEvent) {
                event.preventDefault();

                let eCurRow: HTMLElement = <HTMLElement>event.currentTarget;
                let eCurRowComplement: HTMLElement;
                let dropType: boolean | string;
                let whereTo = isLowerPart(event) ? 'down' : (isUpperPart(event) ? 'up' : 'mid');

                if (eCurRow.parentElement.classList.contains('ag-body-container')) {
                    eCurRowComplement = <HTMLElement>that.ePinnedColsContainer.querySelector(`.ag-row[row="${eCurRow.getAttribute('row')}"]`)
                }
                if (eCurRow.parentElement.classList.contains('ag-pinned-cols-container')) {
                    eCurRowComplement = <HTMLElement>that.eBodyContainer.querySelector(`.ag-row[row="${eCurRow.getAttribute('row')}"]`)
                }

                if (
                    dropType = that.canDrop(
                        that.getSourceOrderIndex(),
                        that.getOrderIndex(thisRowIndex),
                        <HTMLElement>event.target,
                        whereTo == 'mid'
                    )
                ) {
                    clearAllDragStyles();
                    if (eCurRow && eCurRowComplement) {
                        [eCurRow, eCurRowComplement].forEach((el)=>{
                            el.classList.add('ag-dragging-over');
                            el.classList.add(`ag-dragging-over-${whereTo}`);
                        });
                    }
                    let dropEffect = <string>((typeof dropType == 'string') ? dropType : 'move');
                    if (dropEffect && dropEffect != 'none' && whereTo == 'mid') {
                        dropEffect = 'copy';
                    }
                    event.dataTransfer.dropEffect = dropEffect;
                } else {
                    event.dataTransfer.dropEffect = 'none';
                }

            }

            // function onDragOverTarget(event: DragEvent) {
            //     event.preventDefault();
            //     var draggingElement = that.eBodyContainer.querySelector('.ag-dragging');
            //     if (draggingElement) {
            //         draggingElement.getAttribute('row')
            //         if (that.renderedRows[draggingElement.getAttribute('row')].node.data.automatic) {
            //             event.dataTransfer.dropEffect = 'none';
            //         } else {
            //             event.dataTransfer.dropEffect = 'copy';
            //         }
            //     } else {
            //         event.dataTransfer.dropEffect = 'none';
            //     }
            // }

            function onDragEnd() {
                var draggingElement = that.eBodyContainer.querySelector('.ag-dragging');
                if (draggingElement) {
                    draggingElement.classList.remove('ag-dragging');
                }
                clearAllDragStyles();
                that.eventService.dispatchEvent(Events.EVENT_ROW_REORDER);
            }

            function onDragEnter(event: DragEvent, dragHandler: Element) {
                lastenter = event.target;
                event.stopPropagation();
                event.preventDefault();
                return false;
            }

            function onDragLeave(event: Event, dragHandler: Element) {
                // clear classes for row drag styling
                var styleName = 'ag-dragging-over';
                var hostId = that.findParentRow(dragHandler).getAttribute('row');
                if (lastenter === event.target) {
                    var othersDragging = Array.prototype.filter.call(that.eBodyContainer.querySelectorAll('.' + styleName), (element: HTMLElement) => {
                        return element.getAttribute('row') !== hostId;
                    });
                    if (!othersDragging.length) {
                        clearAllDragStyles();
                    }

                    lastenter = null;
                }
            }

            function onDragDrop(event: DragEvent, dropType: string) {

                var lowerPart = isLowerPart(event);
                
                var maxLevels = that.gridOptionsWrapper.getGroupKeys().length;

                var sourceOrderIndex = that.getSourceOrderIndex();
                var destOrderIndex = that.getOrderIndex(thisRowIndex);
                var canDrop = that.canDrop(sourceOrderIndex, destOrderIndex, <HTMLElement>event.target);
                if (!canDrop) return;
                var sourceLevel = (sourceOrderIndex.match(/\./g) || []).length;
                var destLevel = (destOrderIndex.match(/\./g) || []).length;
                var sourceParentIndex = sourceOrderIndex.split('.').slice(0, -1).join('.');
                var destParentIndex = destOrderIndex.split('.').slice(0, -1).join('.');

                var flatData = that.gridOptionsWrapper.getRowData();
                var curNode: any;

                var shiftOrderInfix = function(orderNumber: string, level: number, shift: number) {
                    var splittedOrderNumber = orderNumber.split('.');
                    splittedOrderNumber[level] = (parseInt(splittedOrderNumber[level]) + shift).toString();
                    return splittedOrderNumber.join('.');
                };
                // turn to app for server call
                // need 2 know: 1. source id; 2. destination parent id; 3. order in new parent
                var sourceNodeId = that.getRenderedRows()[event.dataTransfer.getData('text')].node.data.id;
                var destinationNodeId = that.getRenderedRows()[thisRowIndex].node.data.id;
                var destinationParentId = (flatData.filter(function(el) { return el.order.orderNumber == destParentIndex; })[0] || { id: 0 }).id;
                var destOrderAtLevel = parseInt(destOrderIndex.slice(-1));

                var wannaBeShifted = (
                    sourceParentIndex == destParentIndex &&
                    sourceOrderIndex < destOrderIndex
                );

                // console.log(`Порядок назанчения: ${destOrderAtLevel};\nПод: ${isLowerHalf(event)}\nСброс: ${dropType}\nПосле в том же: ${wannaBeShifted}`);

                // 1. Для элементов с порядковым номером источника и всех его дочерних элементов
                // (все элементы, имеющие префикс с номером источника в порядковом номере и следующие за ним, если есть такие)
                // меняем в порядковом номере префикс совпадающий с номером источника на номер назначения
                //
                // Находим индекс источника и меняем его номер
                var idx = 0;
                var parentIndex: number;
                if (sourceParentIndex) {
                    for (; idx < flatData.length; idx++) {
                        if (flatData[idx].order.orderNumber == sourceParentIndex) break;

                    }
                    parentIndex = idx;
                }
                for (;idx < flatData.length; idx++) {
                    if (flatData[idx].order.orderNumber == sourceOrderIndex) break;

                }
                var startSourceIndex = idx;
                var oldIndexPrefix = new RegExp('^' + sourceOrderIndex.replace(new RegExp('\\.', 'g'), '\\.'));
                // Находим индекс, где заканчиваются его дочерние элементы, меняем их префикс на назначение
                for (; idx < flatData.length; idx++) {
                    curNode = flatData[idx];
                    if (!that.isParentByIndex(sourceOrderIndex, curNode.order.orderNumber)) break;

                    curNode.order.orderNumber = curNode.order.orderNumber.replace(
                        oldIndexPrefix,
                        destOrderIndex
                    )
                    // опеределяем максимальный уровень вложенности после переноса всех элементов
                    maxLevels = Math.max(maxLevels, curNode.order.orderNumber.split('.').length);
                    for (var i = 0; i < maxLevels; i++) {
                        delete curNode[`order_${i}`];
                    }
                    curNode.order.orderNumber.split('.').forEach((el, idx) => {
                        curNode[`order_${idx}`] = el;
                    });
                }
                var endSourceIndex = idx;

                // 2. Все последующие элементы с префиксом, совпадающим с родительским префиксом элемента источника
                // (если есть такие) уменьшают инфикс, на уровне, совпадающем с уровнем источника на единицу
                //
                for (; idx < flatData.length; idx++) {
                    curNode = flatData[idx];
                    if (!that.isParentByIndex(sourceParentIndex, curNode.order.orderNumber)) break;

                    curNode.order.orderNumber = shiftOrderInfix(curNode.order.orderNumber, sourceLevel, -1);
                    for (var i = 0; i < maxLevels; i++) {
                        delete curNode[`order_${i}`];
                    }
                    curNode.order.orderNumber.split('.').forEach((el, idx) => {
                        curNode[`order_${idx}`] = el;
                    });
                }

                // 3. Элементы источника и его дочерние элементы вырезаются из списка
                // если у родительского элемента источника, не осталось больше детей меняем его родительский статус
                var shiftBlock = flatData.splice(startSourceIndex, endSourceIndex - startSourceIndex);
                if (flatData[parentIndex] &&
                    (!flatData[parentIndex + 1] ||
                    !that.isParentByIndex(flatData[parentIndex].order.orderNumber, flatData[parentIndex + 1].order.orderNumber))
                ) {
                    flatData[parentIndex].order.isParent = false;
                }

                // 4. Элемент с номером назначения (его может уже и не быть, если его номер изменился в предыдущих пунктах)
                // и все последующие элементы с префиксом, совпадающим с родительским префиксом элемента назначения (если есть)
                // увеличивают инфикс, на уровне, совпадающем с уровнем назначения на единицу
                for (idx = 0; idx < flatData.length; idx++) {
                    curNode = flatData[idx];
                    if (curNode.order.orderNumber == destOrderIndex) break;
                }
                for (; idx < flatData.length; idx++) {
                    curNode = flatData[idx];
                    if (!that.isParentByIndex(destParentIndex, curNode.order.orderNumber)) break;

                    curNode.order.orderNumber = shiftOrderInfix(curNode.order.orderNumber, destLevel, 1);
                    for (var i = 0; i < maxLevels; i++) {
                        delete curNode[`order_${i}`];
                    }
                    curNode.order.orderNumber.split('.').forEach((el, idx) => {
                        curNode[`order_${idx}`] = el;
                    });
                }

                // 5. Дополняем список вырезанными элементами и сортируем по порядковому номеру
                flatData = flatData.concat(shiftBlock);

                flatData.sort((a, b) => {
                    for (var i = 0; i < maxLevels; i++) {
                        if (parseInt(a[`order_${i}`] || 0) > parseInt(b[`order_${i}`] || 0))
                            return 1
                        if (parseInt(a[`order_${i}`] || 0) < parseInt(b[`order_${i}`] || 0))
                            return -1
                    }
                    return 0
                });

                that.gridOptionsWrapper.getApi().setRowData(flatData);

                // if (that.gridOptionsWrapper.getGroupKeys().length !== maxLevels) {
                // }
                var newGroupingKeys = [];
                for (var i = 0; i < maxLevels; i++) {
                    newGroupingKeys.push(`order_${i}`);
                }

                // var col = that.gridOptionsWrapper.gridOptions.columnApi.getColumn('order');
                // that.gridOptionsWrapper.gridOptions.columnApi.setColumnWidth(col, 24 + maxLevels * 17 * 2);
                that.gridOptionsWrapper.gridOptions.wrapper.reGroup(newGroupingKeys);
                // that.gridOptionsWrapper.gridOptions.groupKeys = newGroupingKeys;

                // that.gridOptionsWrapper.getApi().refreshPivot();
                console.log(`
                    source Id: ${sourceNodeId}
                    destination Id: ${destinationNodeId}
                    destination Parent Id: ${destinationParentId}
                    destination order at level: ${destOrderAtLevel}
                    drop type (inside|level): ${dropType}
                    is lower part?: ${lowerPart}
                    wanna be shifted: ${wannaBeShifted}
                 `);

                var moveData = {
                    flatData: flatData,
                    sourceNodeId: sourceNodeId,
                    destinationNodeId: dropType == 'level' ? destinationParentId : destinationNodeId,
                    destinationOrder: (
                        destOrderAtLevel && dropType == 'level' ?
                        (lowerPart ? destOrderAtLevel + (wannaBeShifted ? 0 : 1) : destOrderAtLevel) :
                        null
                    )
                }
                moveData.curNode = curNode;

                that.eventService.dispatchEvent(Events.EVENT_ROW_REORDER, moveData);

                event.stopPropagation();
                event.preventDefault();
                return false;
            }
        }

        /***********************************************
        * END of DND BLOCK
        ************************************************/

        public setListenMouseMove(toAllSet:boolean = true) {
            var eventAction: Function;
            var allRows = this.renderedRows;
            var el: RenderedRow;

            this.isListenMouseMove = toAllSet;

            for (var k in allRows) {
                el = allRows[k];
                eventAction = toAllSet ? el.vBodyRow.addEventListener.bind(el.vBodyRow) : el.vBodyRow.removeEventListener.bind(el.vBodyRow);
                if (toAllSet !== el.isListenForMove()) {
                    // if (window.navigator.msPointerEnabled) {
                    //     eventAction('mousemove', el.listenMoveRef);
                    //     eventAction('MSPointerMove', el.listenMoveRef);
                    // } else {
                    eventAction('mousemove', el.listenMoveRef);
                    // }
                    el.isListenForMove(toAllSet);
                }
            };
        }

        public setHoveredOn(rowNode: any) {
            if (rowNode === null || rowNode === void 0 || !rowNode.node)
                return;
            this.eventService.dispatchEvent(Events.EVENT_ROWS_MOUSE_IN, rowNode);
            this.hoveredOn = rowNode;
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
