/// <reference path="../gridOptionsWrapper.ts" />
/// <reference path="../grid.ts" />
/// <reference path="../utils.ts" />
/// <reference path="../columnController.ts" />
/// <reference path="../expressionService.ts" />
/// <reference path="rowRenderer.ts" />
/// <reference path="../templateService.ts" />
/// <reference path="../selectionController.ts" />
/// <reference path="renderedCell.ts" />
/// <reference path="../virtualDom/vHtmlElement.ts" />

module ag.grid {

    var _ = Utils;


    export class RenderedRow {

        public vPinnedRow: any;
        public vBodyRow: any;

        private renderedCells: {[key: number]: RenderedCell} = {};
        private scope: any;
        private node: any;
        private rowIndex: number;
        private maxRowsNeeded: number;
        private top: number;
        private height: number;
        private topPX: string;
        private heightPX: string;
        private headerHeight: number;
        private rowHeight: number;

        private isListenMove: boolean;
        public listenMoveRef: EventListener;

        private cellRendererMap: {[key: string]: any};

        private gridOptionsWrapper: GridOptionsWrapper;
        private parentScope: any;
        private angularGrid: Grid;
        private columnController: ColumnController;
        private expressionService: ExpressionService;
        private rowRenderer: RowRenderer;
        private selectionRendererFactory: SelectionRendererFactory;
        private $compile: any;
        private templateService: TemplateService;
        private selectionController: SelectionController;
        private pinning: boolean;
        private eBodyContainer: HTMLElement;
        private ePinnedContainer: HTMLElement;
        private valueService: ValueService;
        private eventService: EventService;

        public timing: number;
        public timingReflow: number;

        private isHovered: boolean;

        constructor(gridOptionsWrapper: GridOptionsWrapper,
                    valueService: ValueService,
                    parentScope: any,
                    angularGrid: Grid,
                    columnController: ColumnController,
                    expressionService: ExpressionService,
                    cellRendererMap: {[key: string]: any},
                    selectionRendererFactory: SelectionRendererFactory,
                    $compile: any,
                    templateService: TemplateService,
                    selectionController: SelectionController,
                    rowRenderer: RowRenderer,
                    eBodyContainer: HTMLElement,
                    ePinnedContainer: HTMLElement,
                    node: any,
                    rowIndex: number,
                    eventService: EventService,
                    rowsBefore?: number,
                    topPx?: number,
                    readyToDraw: boolean = true) {
            this.gridOptionsWrapper = gridOptionsWrapper;
            this.valueService = valueService;
            this.parentScope = parentScope;
            this.angularGrid = angularGrid;
            this.expressionService = expressionService;
            this.columnController = columnController;
            this.cellRendererMap = cellRendererMap;
            this.selectionRendererFactory = selectionRendererFactory;
            this.$compile = $compile;
            this.templateService = templateService;
            this.selectionController = selectionController;
            this.rowRenderer = rowRenderer;
            this.eBodyContainer = eBodyContainer;
            this.ePinnedContainer = ePinnedContainer;
            this.pinning = columnController.isPinning();
            this.eventService = eventService;
            this.headerHeight = 0;
            this.rowHeight = 0;
            this.timing = 0;
            this.isHovered = false;


            var eRoot: HTMLElement = _.findParentWithClass(this.eBodyContainer, 'ag-root');

            var groupHeaderTakesEntireRow = this.gridOptionsWrapper.isGroupUseEntireRow();
            
            this.node = node;
            node.structuredGroup = this.node.data && this.node.data.order && this.node.data.order.isParent && this.node.data.span;
            var rowIsHeaderThatSpans = (node.group || node.structuredGroup) && groupHeaderTakesEntireRow;

            var baseHeight:number = this.gridOptionsWrapper.getRowHeight();
            var baseHeightExtra:number = this.gridOptionsWrapper.getRowHeightExtra();
            var maxRows: number = this.gridOptionsWrapper.getMaxRows();
            var minRows: number = this.gridOptionsWrapper.getMinRows();

            this.isListenMove = false;
            this.listenMoveRef = null;

            this.vBodyRow = this.createRowContainer(this.pinning);
            if (this.pinning) {
                this.vPinnedRow = this.createRowContainer();
            }

            this.maxRowsNeeded = 0;
            this.rowIndex = rowIndex;
            this.scope = this.createChildScopeOrNull(node.data);

            if (!rowIsHeaderThatSpans) {
                this.drawNormalRow();
            }

            this.addDynamicStyles();
            this.addDynamicClasses();

            var rowStr = this.rowIndex.toString();
            if (this.node.floatingBottom) {
                rowStr = 'fb-' + rowStr;
            } else if (this.node.floatingTop) {
                rowStr = 'ft-' + rowStr;
            }

            this.vBodyRow.setAttribute('row', rowStr);
            if (this.pinning) {
                this.vPinnedRow.setAttribute('row', rowStr);
            }

            if (typeof this.gridOptionsWrapper.getBusinessKeyForNodeFunc() === 'function') {
                var businessKey = this.gridOptionsWrapper.getBusinessKeyForNodeFunc()(this.node);
                if (typeof businessKey === 'string' || typeof businessKey === 'number') {
                    this.vBodyRow.setAttribute('row-id', businessKey);
                    if (this.pinning) {
                        this.vPinnedRow.setAttribute('row-id', businessKey);
                    }
                }
            }

            var verticalGap = 15; // top/bottom padding + borders (px) default: 15
            var baseHeight = baseHeight; // filed single row height (px) default: 30
            var singleLineHeight = baseHeight - verticalGap; // (px) 
            var numberOfLines = maxRows; // from settings (count)
            var totalLineHeight = singleLineHeight * numberOfLines; // content height (px)
            var rowHeight = totalLineHeight + verticalGap; // height of grid line (px)

            // if showing scrolls, position on the container
            // this.top = rowHeight * rowIndex;
            this.top = topPx;
            this.topPX = `${this.top}px`;
            if (!this.gridOptionsWrapper.isForPrint()) {
                this.vBodyRow.style.top = this.topPX;
                if (this.pinning) {
                    this.vPinnedRow.style.top = this.topPX;
                }
            }

            // this.height = baseHeight * (this.maxRowsNeeded || 1);
            // this.heightPX = `${this.height}px`;
            // this.vBodyRow.style.height =  this.heightPX;
            // if (this.pinning) {
            //     this.vPinnedRow.style.height = this.heightPX;
            // }

            // if group item, insert the first row
            if (rowIsHeaderThatSpans) {
                this.createGroupRow();
            }

            this.bindVirtualElement(this.vBodyRow);
            if (this.pinning) {
                this.bindVirtualElement(this.vPinnedRow);
            }

            if (this.scope) {
                this.$compile(this.vBodyRow.getElement())(this.scope);
                if (this.pinning) {
                    this.$compile(this.vPinnedRow.getElement())(this.scope);
                }
            }
            this.rowHeight = 0;
            if (readyToDraw) {
                this.insertInDOM();
                this.renderAndMeasureHeight(
                    totalLineHeight,
                    singleLineHeight,
                    baseHeight,
                    rowHeight,
                    maxRows,
                    minRows,
                    verticalGap
                );

            }
        }

        private onRowStop() {
            console.log('event mouse out');
        }

        private renderAndMeasureHeight(
            totalLineHeight: number, singleLineHeight: number,
            baseHeight: number, rowHeight: number,
            maxRows: number, minRows: number,
            verticalGap: number,

        ) {

            var keys = Object.keys(this.renderedCells);
            for (let idx = keys.length; idx-- > 0; ) {
            // for (var key in this.renderedCells) {

                var cellObj: RenderedCell = this.renderedCells[keys[idx]];
                var cellObjEl: any = cellObj.getVGridCell();
                cellObjEl = cellObjEl.getElement();
                // var foundElementToWrap = cellObjEl.querySelector('.ag-text-wrap');
                var foundElementToWrap = cellObjEl.getElementsByClassName('ag-text-wrap')[0];

                if (!foundElementToWrap) {
                    continue;
                }

                if (maxRows == minRows) {
                    foundElementToWrap.style['max-height'] = `${totalLineHeight}px`;
                    foundElementToWrap.style['height'] = `${totalLineHeight}px`;
                    foundElementToWrap.style['line-height'] = `${singleLineHeight}px`;

                    _.reflowText(foundElementToWrap, foundElementToWrap.innerHTML);
                    this.rowHeight = rowHeight;
                } else {
                    foundElementToWrap.style['max-height'] = ``;
                    foundElementToWrap.style['height'] = ``;
                    foundElementToWrap.style['line-height'] = `${singleLineHeight}px`;
                    foundElementToWrap.style['overflow'] = `visible`;
                    var requiredHeight = foundElementToWrap.scrollHeight + verticalGap;
                    this.rowHeight = requiredHeight > this.rowHeight ? requiredHeight : this.rowHeight;
                }


            };

            if (!this.rowHeight) {
                this.rowHeight = baseHeight;
            }

            this.height = this.rowHeight;
            this.heightPX = `${this.height}px`;
            this.vBodyRow.element.style.height =  this.heightPX;
            if (this.pinning) {
                this.vPinnedRow.element.style.height = this.heightPX;
            }
            
        }

        private renderAndMeasureHeightSome(
            totalLineHeight: number, singleLineHeight: number,
            baseHeight: number, rowHeight: number,
            maxRows: number, minRows: number,
            verticalGap: number,

        ) {
            if (!this.rowHeight) {
                this.rowHeight = baseHeight;
            }
            this.height = this.rowHeight;
            this.heightPX = `${this.height}px`;
            this.vBodyRow.element.style.height =  this.heightPX;
            if (this.pinning) {
                this.vPinnedRow.element.style.height = this.heightPX;
            }
        }

        public positionTop(px: number) {
            this.top = px;
            this.topPX = `${this.top}px`;
            if (!this.gridOptionsWrapper.isForPrint()) {
                this.vBodyRow.element.style.top = this.topPX;
                if (this.pinning) {
                    this.vPinnedRow.element.style.top = this.topPX;
                }
            }          
        }

        public getHeight(): number {
            return this.rowHeight;
        }

        public getVerticalFrame(): any {
            return {
                top: this.top,
                bottom: this.top + this.height
            };
        }

        public insertInDOM() {
            this.eBodyContainer.appendChild(this.vBodyRow.getElement());
            if (this.pinning) {
                this.ePinnedContainer.appendChild(this.vPinnedRow.getElement());
            }
        }

        public getMaxRowsNeeded(): number {
            return this.maxRowsNeeded;
        }

        public onRowSelected(selected: boolean): void {
            _.iterateObject(this.renderedCells, (key: any, renderedCell: RenderedCell)=> {
                renderedCell.setSelected(selected);
            });
        }

        public softRefresh(): void {
            _.iterateObject(this.renderedCells, (key: any, renderedCell: RenderedCell)=> {
                if (renderedCell.isVolatile()) {
                    renderedCell.refreshCell();
                }
            });
        }

        public getRenderedCellForColumn(column: Column): RenderedCell {
            return this.renderedCells[column.index];
        }

        public getCellForCol(column: Column): any {
            var renderedCell = this.renderedCells[column.index];
            if (renderedCell) {
                return renderedCell.getVGridCell().getElement();
            } else {
                return null;
            }
        }

        public destroy(): void {
            this.destroyScope();

            if (this.pinning) {
                this.ePinnedContainer.removeChild(this.vPinnedRow.getElement());
            }
            this.eBodyContainer.removeChild(this.vBodyRow.getElement());
        }

        private destroyScope(): void {
            if (this.scope) {
                this.scope.$destroy();
                this.scope = null;
            }
        }

        public isDataInList(rows: any[]): boolean {
            return rows.indexOf(this.node.data) >= 0;
        }

        public isNodeInList(nodes: RowNode[]): boolean {
            return nodes.indexOf(this.node) >= 0;
        }

        public isGroup(): boolean {
            return this.node.group === true;
        }

        public getId(): any {
            return this.node.id;
        }

        public getNode(): any {
            return this.node;
        }

        private drawNormalRow() {
            var columns = this.columnController.getDisplayedColumns();
            var maxRowsNeeded = 0;
            for (var i = 0; i<columns.length; i++) {
                var column = columns[i];
                var firstCol = i === 0;
                var multiLine: any;

                // var value = this.valueService.getValue(column.colDef, this.node.data, this.node);
                // multiLine = _.getWidthHeight(
                //     value,
                //     column.actualWidth,
                //     this.gridOptionsWrapper.getFont(),
                //     10
                // );

                var renderedCell = new RenderedCell(firstCol, column,
                    this.$compile, this.rowRenderer, this.gridOptionsWrapper, this.expressionService,
                    this.selectionRendererFactory, this.selectionController, this.templateService,
                    this.cellRendererMap, this.node, this.rowIndex, this.scope, this.columnController,
                    this.valueService, this.eventService);
                
                maxRowsNeeded = Math.max(renderedCell.getRowsNeeded(), maxRowsNeeded);

                var vGridCell = renderedCell.getVGridCell();
                
                if (column.pinned) {
                    this.vPinnedRow.appendChild(vGridCell);
                } else {
                    this.vBodyRow.appendChild(vGridCell);
                }
                // vGridCell.addElementAttachedListener(function(a){
                //     if (a.getAttribute('v_element_id') === '3800') {
                //         console.log(a);
                //         console.log(a.parentElement);
                //         console.log(document.body.contains(a));
                //         // a.parentElement.add
                //     }
                // });

                this.renderedCells[column.index] = renderedCell;
            }
            this.maxRowsNeeded = maxRowsNeeded;
        }

        private bindVirtualElement(vElement: ag.vdom.VHtmlElement): void {
            var html = vElement.toHtmlString();
            var element: Element = <Element> _.loadTemplate(html);
            vElement.elementAttached(element);
        }

        private createGroupRow() {
            var eGroupRow = this.createGroupSpanningEntireRowCell(false);

            if (this.pinning) {
                this.vPinnedRow.appendChild(eGroupRow);
                var eGroupRowPadding = this.createGroupSpanningEntireRowCell(true);
                this.vBodyRow.appendChild(eGroupRowPadding);
            } else {
                this.vBodyRow.appendChild(eGroupRow);
            }
        }

        private createGroupSpanningEntireRowCell(padding: any) {
            var eRow: any;
            // padding means we are on the right hand side of a pinned table, ie
            // in the main body.
            if (padding) {
                eRow = document.createElement('span');
            } else {
                var rowCellRenderer = this.gridOptionsWrapper.getGroupRowRenderer();
                if (!rowCellRenderer) {
                    rowCellRenderer = {
                        renderer: 'group',
                        innerRenderer: this.gridOptionsWrapper.getGroupRowInnerRenderer()
                    };
                }
                var params = {
                    node: this.node,
                    data: this.node.data,
                    rowIndex: this.rowIndex,
                    api: this.gridOptionsWrapper.getApi(),
                    colDef: {
                        cellRenderer: rowCellRenderer
                    }
                };

                // start duplicated code
                var actualCellRenderer: Function;
                if (typeof rowCellRenderer === 'object' && rowCellRenderer !== null) {
                    var cellRendererObj = <{ renderer: string }> rowCellRenderer;
                    actualCellRenderer = this.cellRendererMap[cellRendererObj.renderer];
                    if (!actualCellRenderer) {
                        throw 'Cell renderer ' + rowCellRenderer + ' not found, available are ' + Object.keys(this.cellRendererMap);
                    }
                } else if (typeof rowCellRenderer === 'function') {
                    actualCellRenderer = <Function>rowCellRenderer;
                } else {
                    throw 'Cell Renderer must be String or Function';
                }
                var resultFromRenderer = actualCellRenderer(params);
                // end duplicated code

                if (_.isNodeOrElement(resultFromRenderer)) {
                    // a dom node or element was returned, so add child
                    eRow = resultFromRenderer;
                } else {
                    // otherwise assume it was html, so just insert
                    eRow = _.loadTemplate(resultFromRenderer);
                }
            }
            if (this.node.footer) {
                _.addCssClass(eRow, 'ag-footer-cell-entire-row');
            } else {
                _.addCssClass(eRow, 'ag-group-cell-entire-row');
            }

            return eRow;
        }

        public setMainRowWidth(width: number) {
            this.vBodyRow.addStyles({width: width + "px"});
        }

        private createChildScopeOrNull(data: any) {
            if (this.gridOptionsWrapper.isAngularCompileRows()) {
                var newChildScope = this.parentScope.$new();
                newChildScope.data = data;
                return newChildScope;
            } else {
                return null;
            }
        }

        private addDynamicStyles() {
            var rowStyle = this.gridOptionsWrapper.getRowStyle();
            if (rowStyle) {
                if (typeof rowStyle === 'function') {
                    console.log('ag-Grid: rowStyle should be a string or an array, not be a function, use getRowStyle() instead');
                } else {
                    this.vBodyRow.addStyles(rowStyle);
                    if (this.pinning) {
                        this.vPinnedRow.addStyles(rowStyle);
                    }
                }
            }
            var rowStyleFunc = this.gridOptionsWrapper.getRowStyleFunc();
            if (rowStyleFunc) {
                var params = {
                    data: this.node.data,
                    node: this.node,
                    api: this.gridOptionsWrapper.getApi(),
                    context: this.gridOptionsWrapper.getContext(),
                    $scope: this.scope
                };
                var cssToUseFromFunc = rowStyleFunc(params);
                this.vBodyRow.addStyles(cssToUseFromFunc);
                if (this.pinning) {
                    this.vPinnedRow.addStyles(cssToUseFromFunc);
                }
            }
        }

        private createParams(): any {
            var params = {
                node: this.node,
                data: this.node.data,
                rowIndex: this.rowIndex,
                $scope: this.scope,
                context: this.gridOptionsWrapper.getContext(),
                api: this.gridOptionsWrapper.getApi()
            };
            return params;
        }

        private createEvent(event: any, eventSource: any): any {
            var agEvent = this.createParams();
            agEvent.event = event;
            agEvent.eventSource = eventSource;
            return agEvent;
        }

        private shutDownHover (event: any) {
            let counterpartEl: HTMLElement;
            this.isHovered = false;
            this.vBodyRow.removeClass('ag-row-hover');
            let overlayRow = <HTMLElement> document.querySelector('#ag-overlay-row');
            if (overlayRow) {
                overlayRow.style.display = 'none';
            }
            if (this.vBodyRow.element.parentElement && this.vBodyRow.element.parentElement.classList.contains('ag-pinned-cols-container')) {
                counterpartEl = this.vBodyRow.element.parentElement.parentElement.parentElement.querySelector(
                    `.ag-body-container .ag-row[row="${this.vBodyRow.element.getAttribute('row')}"]`
                );
                if (counterpartEl) counterpartEl.classList.remove('ag-row-hover');
            } else if (this.vBodyRow.element.parentElement && this.vBodyRow.element.parentElement.classList.contains('ag-body-container')) {
                counterpartEl = this.vBodyRow.element.parentElement.parentElement.parentElement.parentElement.querySelector(
                    `.ag-pinned-cols-container .ag-row[row="${this.vBodyRow.element.getAttribute('row')}"]`
                );
                if (counterpartEl) counterpartEl.classList.remove('ag-row-hover');
            }
            this.eventService.removeEventListener(Events.EVENT_ALL_ROWS_STOP_LISTEN_MOUSE_MOVE, this.stopListenMouseMoveFn);
        }

        private createRowContainer(pinning: Boolean = false) {
            var vRow = new ag.vdom.VHtmlElement('div');
            var vStrip = new ag.vdom.VHtmlElement('div');
            vStrip.addClass('ag-row-strip');
            var rootName = '';
            var rootStatus = '';
            var rootStatusClass = '';
            var rootBlocked = false;

            if (!pinning) {
                if (this.node.data && this.node.data.dataRoot) {
                    rootName = this.node.data.dataRoot.name || '';
                    rootStatus = this.node.data.dataRoot.status || ''
                    rootBlocked = this.node.data.dataRoot.blocked || false
                }
                rootStatus = rootStatus.toLowerCase();
                if (rootStatus) {
                    if (rootBlocked) {
                        vStrip.addClass(`ag-strip-status-blocked`);
                    } else {
                        vStrip.addClass(`ag-strip-status-${rootStatus}`);
                    }
                }
                vStrip.setAttribute('title', rootName);
                vRow.appendChild(vStrip);
            }

            var that = this;


            let listenMove = function listenMove(event: any) {
                var eRoot:HTMLElement = _.findParentWithClass(that.eBodyContainer, 'ag-root');
                var eOverlayZone: HTMLElement = <HTMLElement>eRoot.querySelector('.ag-overlay-row-zone');
                var eRowOverlay:HTMLElement = <HTMLElement>document.querySelector('#ag-overlay-row');
                var headerHeight = (that.gridOptionsWrapper && that.gridOptionsWrapper.getHeaderHeight()) || 0;
                var thisRowElement = vRow.getElement();

                if (event) {
                    var x = event.clientX;
                    var y = event.clientY;
                    var elementMouseIsOver = document.elementFromPoint(x, y);
                }

                if (elementMouseIsOver && elementMouseIsOver.classList) {
                    if (!elementMouseIsOver.classList.contains('ag-cell')) {
                        return;
                    }
                }


                that.rowRenderer.setHoveredOn(null);

                if (that.node && eRowOverlay) {
                    if (that.node.group) {
                        eRowOverlay.style.display = 'none';
                    } else {
                        eRowOverlay.style.display = '';

                        eRowOverlay.style.top = `${
                            thisRowElement.offsetTop - that.eBodyContainer.parentElement.scrollTop - 1 - parseInt(eOverlayZone.style.top) + headerHeight
                        }px`;
                        eRowOverlay.style.height = that.heightPX;
                        that.rowRenderer.setHoveredOn(that);
                    }
                }

                // if (!eRowOverlay.firstElementChild.firstElementChild.firstElementChild) {
                //     that.rowRenderer.gridPanel.showOverlayRow(that.node.data);
                // }
                that.rowRenderer.gridPanel.showOverlayRow(that.node.data);

                that.rowRenderer.setListenMouseMove();
                that.isListenMove = false;
                that.vBodyRow.getElement().removeEventListener('mousemove', listenMove);
            }
            this.listenMoveRef = listenMove;
            this.isListenMove = false;

            vRow.addEventListener("click", function (event: any) {
                var agEvent = that.createEvent(event, this);
                that.eventService.dispatchEvent(Events.EVENT_ROW_CLICKED, agEvent);

                // ctrlKey for windows, metaKey for Apple
                var multiSelectKeyPressed = event.ctrlKey || event.metaKey;
                that.angularGrid.onRowClicked(multiSelectKeyPressed, that.rowIndex, that.node);
            });
            vRow.addEventListener("dblclick", function (event: any) {
                var agEvent = that.createEvent(event, this);
                that.eventService.dispatchEvent(Events.EVENT_ROW_DOUBLE_CLICKED, agEvent);
            });
            vRow.addEventListener("mouseenter", function (event: any) {
                that.stopListenMouseMoveFn = that.shutDownHover.bind(that)
                that.eventService.addEventListener(Events.EVENT_ALL_ROWS_STOP_LISTEN_MOUSE_MOVE, that.stopListenMouseMoveFn);
                let counterpartEl: HTMLElement;
                that.isHovered = true;
                vRow.addClass('ag-row-hover');
                listenMove(undefined);
                if (vRow.element.parentElement.classList.contains('ag-pinned-cols-container')) {
                    counterpartEl = vRow.element.parentElement.parentElement.parentElement.querySelector(
                        `.ag-body-container .ag-row[row="${vRow.element.getAttribute('row')}"]`
                    );
                    if (counterpartEl) counterpartEl.classList.add('ag-row-hover');
                } else if (vRow.element.parentElement.classList.contains('ag-body-container')) {
                    counterpartEl = vRow.element.parentElement.parentElement.parentElement.parentElement.querySelector(
                        `.ag-pinned-cols-container .ag-row[row="${vRow.element.getAttribute('row')}"]`
                    );
                    if (counterpartEl) counterpartEl.classList.add('ag-row-hover');
                }
            });
            vRow.addEventListener("mouseleave", this.shutDownHover.bind(this));

            return vRow;
        }

        public isListenForMove(newValue?: boolean): boolean {
            if (newValue !== void 0) {
                this.isListenMove = newValue;
            }
            return this.isListenMove;
        }


        public getRowNode(): any {
            return this.node;
        }

        public getRowIndex(): any {
            return this.rowIndex;
        }

        public refreshCells(colIds: string[]): void {
            if (!colIds) {
                return;
            }
            var columnsToRefresh = this.columnController.getColumns(colIds);

            _.iterateObject(this.renderedCells, (key: any, renderedCell: RenderedCell)=> {
                var colForCel = renderedCell.getColumn();
                if (columnsToRefresh.indexOf(colForCel)>=0) {
                    renderedCell.refreshCell();
                }
            });
        }

        private addDynamicClasses() {
            var classes: string[] = [];
            var auxGroupClasses: string[];
            var levelNumber: number = -1;

            classes.push('ag-row');
            if (this.gridOptionsWrapper.isRowDrug(this) && this.gridOptionsWrapper.gridOptions.groupKeys && ~this.gridOptionsWrapper.gridOptions.groupKeys.indexOf('order_0')) {
                classes.push('ag-js-draghandler');
            }

            classes.push(this.rowIndex % 2 == 0 ? "ag-row-even" : "ag-row-odd");

            if (this.node.data && this.node.data.order && this.node.data.order.isParent) {
                levelNumber = this.node.data.order.orderNumber.split('.').length - 1;
                classes.push('ag-row-group');
                classes.push(`ag-row-group-level-${levelNumber}`);
            }

            if (this.node.data && this.node.data.strip) {
                classes.push('ag-row-stripped');
            }

            if (this.node.data && this.node.data.type == 'structure') {
                classes.push('ag-row-group-structutre-no_background');
            }
            if (this.node.data && this.node.data.type == 'subprogram') {
                classes.push('ag-row-group-structutre-no_background');
            }
            if (this.node.data && this.node.data.type == 'project') {
                classes.push('ag-row-group-structutre-no_background');
            }

            if (this.node.data && this.node.data.isParentAccepted) {
                classes.push('ag-row_inactive');
            }

            if (this.selectionController.isNodeSelected(this.node)) {
                classes.push("ag-row-selected");
            }

            if (this.node.group) {
                classes.push("ag-row-group");
                // if a group, put the level of the group in
                classes.push("ag-row-level-" + this.node.level);
                classes.push("ag-row-group-level-" + this.node.level);
                levelNumber = this.node.level;

                if (!this.node.footer && this.node.expanded) {
                    classes.push("ag-row-group-expanded");
                }
                if (!this.node.footer && !this.node.expanded) {
                    // opposite of expanded is contracted according to the internet.
                    classes.push("ag-row-group-contracted");
                }
                if (this.node.footer) {
                    classes.push("ag-row-footer");
                }
            } else {
                // if a leaf, and a parent exists, put a level of the parent, else put level of 0 for top level item
                if (this.node.parent) {
                    classes.push("ag-row-level-" + (this.node.parent.level + 1));
                } else {
                    classes.push("ag-row-level-0");
                }
            }

            auxGroupClasses = this.gridOptionsWrapper.gridOptions.groupClasses || [];
            if (levelNumber >= 0 && auxGroupClasses && auxGroupClasses.length) {
                if (levelNumber <= auxGroupClasses.length) {
                    classes.push(auxGroupClasses[levelNumber]);
                } else {
                    classes.push(auxGroupClasses[auxGroupClasses.length - 1]);
                }
            }

            // add in extra classes provided by the config
            var gridOptionsRowClass = this.gridOptionsWrapper.getRowClass();
            if (gridOptionsRowClass) {
                if (typeof gridOptionsRowClass === 'function') {
                    console.warn('ag-Grid: rowClass should not be a function, please use getRowClass instead');
                } else {
                    if (typeof gridOptionsRowClass === 'string') {
                        classes.push(gridOptionsRowClass);
                    } else if (Array.isArray(gridOptionsRowClass)) {
                        gridOptionsRowClass.forEach(function (classItem: any) {
                            classes.push(classItem);
                        });
                    }
                }
            }

            var gridOptionsRowClassFunc = this.gridOptionsWrapper.getRowClassFunc();
            if (gridOptionsRowClassFunc) {
                var params = {
                    node: this.node,
                    data: this.node.data,
                    rowIndex: this.rowIndex,
                    context: this.gridOptionsWrapper.getContext(),
                    api: this.gridOptionsWrapper.getApi()
                };
                var classToUseFromFunc = gridOptionsRowClassFunc(params);
                if (classToUseFromFunc) {
                    if (typeof classToUseFromFunc === 'string') {
                        classes.push(classToUseFromFunc);
                    } else if (Array.isArray(classToUseFromFunc)) {
                        classToUseFromFunc.forEach(function (classItem: any) {
                            classes.push(classItem);
                        });
                    }
                }
            }

            this.vBodyRow.addClasses(classes);
            if (this.pinning) {
                this.vPinnedRow.addClasses(classes);
            }
        }
    }

}
