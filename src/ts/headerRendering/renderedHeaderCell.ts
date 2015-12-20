/// <reference path='../utils.ts' />
/// <reference path='../filter/filterManager.ts' />
/// <reference path='../gridOptionsWrapper.ts' />
/// <reference path='../columnController.ts' />
/// <reference path='renderedHeaderElement.ts' />
/// <reference path="../widgets/agPopupService.ts" />

module ag.grid {

    var _ = Utils;
    var constants = Constants;
    var svgFactory = SvgFactory.getInstance();

    export class RenderedHeaderCell extends RenderedHeaderElement {

        private static DEFAULT_SORTING_ORDER = [constants.ASC, constants.DESC, null];

        private eHeaderCell: HTMLElement;
        private eSortAsc: HTMLElement;
        private eSortDesc: HTMLElement;
        private eSortNone: HTMLElement;
        private eFilterIcon: HTMLElement;

        private column: Column;
        private gridOptionsWrapper: GridOptionsWrapper;
        private parentScope: any;
        private childScope: any; //todo: destroy this
        private filterManager: FilterManager;
        private columnController: ColumnController;
        private $compile: any;
        private angularGrid: Grid;
        private parentGroup: RenderedHeaderGroupCell;
        private popupService: PopupService;
        private eRootRef: HTMLElement;

        private startWidth: number;
        private headerElements: any;
        private lockedForResize: boolean;

        constructor(column: Column, headerElements: any,
                    parentGroup: RenderedHeaderGroupCell, gridOptionsWrapper: GridOptionsWrapper,
                    parentScope: any, filterManager: FilterManager, columnController: ColumnController,
                    $compile: any, angularGrid: Grid, eRoot: HTMLElement, popupService?: PopupService ) {
            super(eRoot);
            this.eRootRef = eRoot;
            this.column = column;
            this.parentGroup = parentGroup;
            this.gridOptionsWrapper = gridOptionsWrapper;
            this.parentScope = parentScope;
            this.filterManager = filterManager;
            this.columnController = columnController;
            this.$compile = $compile;
            this.angularGrid = angularGrid;
            this.popupService = popupService;
            this.headerElements = headerElements;
            this.lockedForResize = false;

            this.setupComponents();
        }

        public getGui(): HTMLElement {
            return this.eHeaderCell;
        }

        public destroy(): void {
            if (this.childScope) {
                this.childScope.$destroy();
            }
        }

        private createScope(): void {
            if (this.gridOptionsWrapper.isAngularCompileHeaders()) {
                this.childScope = this.parentScope.$new();
                this.childScope.colDef = this.column.colDef;
                this.childScope.colIndex = this.column.index;
                this.childScope.colDefWrapper = this.column;
            }
        }

        private addAttributes(): void {
            this.eHeaderCell.setAttribute("col", (this.column.index !== undefined && this.column.index !== null) ? this.column.index.toString() : '');
            this.eHeaderCell.setAttribute("colId", this.column.colId);
        }

        private addClasses(): void {
            _.addCssClass(this.eHeaderCell, 'ag-header-cell');

            if (this.gridOptionsWrapper.isGroupHeaders() && this.parentGroup && this.parentGroup.getVisibleColumnsCount() > 1) {
                _.addCssClass(this.eHeaderCell, 'ag-header-cell-grouped'); // this takes 50% height
            } else {
                _.addCssClass(this.eHeaderCell, 'ag-header-cell-not-grouped'); // this takes 100% height
            }
        }

        private addSortIcons(headerCellLabel: HTMLElement): void {
            var addSortIcons = this.gridOptionsWrapper.isEnableSorting() && !this.column.colDef.suppressSorting;
            if (!addSortIcons) {
                return;
            }

            this.eSortAsc = _.createIcon('sortAscending', this.gridOptionsWrapper, this.column, svgFactory.createArrowUpSvg);
            this.eSortDesc = _.createIcon('sortDescending', this.gridOptionsWrapper, this.column, svgFactory.createArrowDownSvg);
            _.addCssClass(this.eSortAsc, 'ag-header-icon ag-sort-ascending-icon');
            _.addCssClass(this.eSortDesc, 'ag-header-icon ag-sort-descending-icon');
            headerCellLabel.appendChild(this.eSortAsc);
            headerCellLabel.appendChild(this.eSortDesc);

            // 'no sort' icon
            if (this.column.colDef.unSortIcon || this.gridOptionsWrapper.isUnSortIcon()) {
                this.eSortNone = _.createIcon('sortUnSort', this.gridOptionsWrapper, this.column, svgFactory.createArrowUpDownSvg);
                _.addCssClass(this.eSortNone, 'ag-header-icon ag-sort-none-icon');
                headerCellLabel.appendChild(this.eSortNone);
            }

            this.eSortAsc.style.display = 'none';
            this.eSortDesc.style.display = 'none';
            this.addSortHandling(headerCellLabel);
        }

        private setupComponents(): void {
            var that = this;

            this.eHeaderCell = document.createElement("div");

            if (this.headerElements.frame) {
                this.createScope();
                this.addClasses();
                this.addHeaderClassesFromCollDef();
                this.addAttributes();
            }

            // add tooltip if exists
            if (this.column.colDef.headerTooltip) {
                this.eHeaderCell.title = this.column.colDef.headerTooltip;
            }

            if (this.headerElements.resize && this.gridOptionsWrapper.isEnableColResize() && !this.column.colDef.suppressResize) {
                var headerCellResize = document.createElement("div");
                headerCellResize.className = "ag-header-cell-resize";
                this.eHeaderCell.appendChild(headerCellResize);
                this.addDragHandler(headerCellResize);
            }

            // this.addMenu();

            // label div
            var headerCellLabel = document.createElement("div");
            headerCellLabel.className = "ag-header-cell-label";
            if (this.gridOptionsWrapper.isGroupHeaders() && this.parentGroup && this.parentGroup.getVisibleColumnsCount() > 1) {
                headerCellLabel.setAttribute('colId', this.column.colId);
            }

            // add in sort icons
            // this.addSortIcons(headerCellLabel);


            // add in filter icon
            // this.eFilterIcon = _.createIcon('filter', this.gridOptionsWrapper, this.column, svgFactory.createFilterSvg);
            // _.addCssClass(this.eFilterIcon, 'ag-header-icon');
            // headerCellLabel.appendChild(this.eFilterIcon);

            // render the cell, use a renderer if one is provided
            var headerNameValue = this.columnController.getDisplayNameForCol(this.column);
            var headerCellRenderer: any;
            if (this.column.colDef.headerCellRenderer) { // first look for a renderer in col def
                headerCellRenderer = this.column.colDef.headerCellRenderer;
            } else if (this.gridOptionsWrapper.getHeaderCellRenderer()) { // second look for one in grid options
                headerCellRenderer = this.gridOptionsWrapper.getHeaderCellRenderer();
            } else {
                var sortBlock = '';
                if (this.headerElements.sort) {
                    sortBlock = `
                    <div class="ag-header-action-sort">
                      <span class="ag-sort-icon b-icon icon-sort-arrow-up"></span>
                      <span class="ag-sort-icon b-icon icon-sort-arrow-down"></span>
                      <span class="ag-sort-icon b-icon icon-sort-alpha-up "></span>
                      <span class="ag-sort-icon b-icon icon-sort-alpha-down"></span>
                    </div>
                    `;
                }
                var freezeBlock = '';
                if (this.headerElements.freeze) {
                    // <div class="b-content__cell">
                    freezeBlock = `
                    <div class="ag-header-action-lock ag-locked-icon">
                      <div class="pi-table-column-locked" >
                          <label>
                              <span class="checkbox-input">
                                  <input id="ag-js-freeze" name="locked" type="checkbox" />
                                  <span class="input-icon"></span>
                              </span>
                          </label>
                      </div>
                    </div>
                    `;
                }
                headerCellRenderer = function() {
                    return `
                    <div class="ag-header-cell-actionbox ag-js-draghandler">
                      <div class="ag-header-text">
                        ${headerNameValue || ''}
                      </div>
                      <div class="ag-header-action">
                        ${freezeBlock}    
                        ${sortBlock}    
                      </div>
                    </div>                    
                    `;
                }
            }


            if (headerCellRenderer) {
                this.useRenderer(headerNameValue, headerCellRenderer, headerCellLabel);
            } else {
                // no renderer, default text render
                var eInnerText = document.createElement("span");
                eInnerText.className = 'ag-header-cell-text';
                eInnerText.innerHTML = headerNameValue;
                headerCellLabel.appendChild(eInnerText);
            }

            if (this.headerElements.frame) {
                this.eHeaderCell.appendChild(headerCellLabel);
                this.eHeaderCell.style.width = _.formatWidth(this.column.actualWidth);
            } else {
                this.eHeaderCell = headerCellLabel;
            }

            if (this.headerElements.drag) {
                var dragHandler = this.eHeaderCell.querySelector('.ag-js-draghandler');
                if (dragHandler) this.setupDND(dragHandler);
            }

            if (this.headerElements.sort) {
                this.addSortHandling(this.eHeaderCell);
            }

            if (this.headerElements.freeze) {
                var freezeChecker = this.eHeaderCell.querySelector('#ag-js-freeze');
                if (freezeChecker) this.setupFreeze(freezeChecker);
            }

        }

        private detectDragParties() {
            var src = this.getDragSource()
            var sourceAttrs = this.detectDragParty(src);
            var destAttrs = this.detectDragParty(this.column);
            return {
                sourceAttrs: sourceAttrs,
                destAttrs: destAttrs
            }
        }

        private canDrop(providedAttrs?: any): boolean {
            // source and data types to forbid or not the drop.
            // The states are: bracket, header, cellmate
            //        bracket -> bracket: ok
            //        bracket -> header: ok
            //        bracket -> cellmate: no
            //        header - same as bracket
            //        cellmate - bracket: no
            //        cellmate - header: no
            //        cellmate - own mate: ok
            //        cellmate - mate: no
            var attrs = providedAttrs || this.detectDragParties();

            if (attrs.sourceAttrs.colId === attrs.destAttrs.colId) {
                return false;
            }
            if (attrs.sourceAttrs.isCellmate) {
                return (
                    attrs.sourceAttrs.bracketId &&
                    attrs.sourceAttrs.bracketId === attrs.destAttrs.bracketId
                )
            } else {
                return !attrs.destAttrs.isCellmate;
            }
        }

        private detectDragParty(columnOrGroup: Column):any {
            // type (bracket|header|cellmate)
            //    isBracket: true|false
            //    isCellmate: true|false
            // column indexes: left and right edge
            // parent object for cellmate
            var isBracket = false;
            var isCellmate = false;
            var parentId: string;
            var colStartIndex: number;
            var colEndIndex: number;
            var colId = columnOrGroup.colId;
            var colGroup: ColumnGroup = this.columnController.getColumnGroup(colId);

            if (colGroup) {
                colId = colGroup.allColumns[0].colId;
                isBracket = true;
                colStartIndex = colGroup.displayedColumns[0].index;
                colEndIndex = colGroup.displayedColumns.slice(-1)[0].index;
            } else {
                if (columnOrGroup.colDef && columnOrGroup.colDef.headerGroup) {
                    isCellmate = true;
                    parentId = columnOrGroup.colDef.headerGroup;
                }
                colStartIndex = columnOrGroup.index;
            }

            return {
                isBracket: isBracket,
                isCellmate: isCellmate,
                colStartIndex: colStartIndex,
                colEndIndex: colEndIndex || colStartIndex,
                colId: colId,
                bracketId: parentId
            }
        } 

        private getDragSource(): any {
            // drag source is a single element with 'dragging' class
            var sourceColEl = this.eRootRef.querySelector('.ag-dragging');
            var sourceColId = sourceColEl.getAttribute('colId');
            if (!sourceColId) {
                sourceColId = sourceColEl.querySelector('.ag-header-group-cell').getAttribute('colId');
            }
            var draggingColumnObject:any = this.columnController.getColumn(sourceColId);
            if (!draggingColumnObject) {
                draggingColumnObject = this.columnController.getColumnGroup(sourceColId).getBracketHeader().column;
            }
            return draggingColumnObject;
        }

        private setupDND(dragHandler: Element) {
            var that = this;
            dragHandler.setAttribute('draggable', 'true');


            // start/stop dragging header
            dragHandler.addEventListener('dragstart', function(event: DragEvent) {
                // debugger;
                if (that.eHeaderCell.parentElement.classList.contains('ag-header-group-cell-with-group')) {
                    that.eHeaderCell.parentElement.parentElement.classList.add('ag-dragging');
                } else {
                    that.eHeaderCell.classList.add('ag-dragging');
                }
                event.dataTransfer.setData('text/plain', that.column.colId);
            });

            dragHandler.addEventListener('dragover', function(event: DragEvent) {
                event.preventDefault();
                if (that.canDrop()) {
                    event.dataTransfer.dropEffect = 'move';
                } else {
                    event.dataTransfer.dropEffect = 'none';
                }
            });
            dragHandler.addEventListener('dragend', function() {
                var draggingElement = that.eRootRef.querySelector('.ag-dragging');
                if (draggingElement) {
                    draggingElement.classList.remove('ag-dragging');
                }

                clearAllDragStyles();
            });

            // react to drag header over header
            var lastenter: any;

            var clearAllDragStyles = () => {
                var stylesToClear: string[] = ['ag-dragging-over', 'ag-dragging-over-right', 'ag-dragging-over-left'];
                stylesToClear.forEach((styleName: string) => {
                    Array.prototype.forEach.call(this.eRootRef.querySelectorAll('.' + styleName), (element: HTMLElement) => {
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
            this.eHeaderCell.addEventListener('drop', function(event:DragEvent) {
                var freezeIndex = that.columnController.getPinnedColumnCount();
                var dragData = event.dataTransfer.getData('text/plain');
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
                var dSrcDest= Math.abs(destColumnAttrs.colStartIndex - srcColumnAttrs.colStartIndex) + 1;

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
                    that.columnController.moveColumn(fromIdx, toIdx);
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

        private setupFreeze(freezeChecker: Element) {
            var that = this;
            var columnsInGroup: Column[];
            var lastColumnInGroup: Column;
            if (that.column.colDef.columnGroup) {
                columnsInGroup = that.column.colDef.columnGroup.displayedColumns
                lastColumnInGroup = columnsInGroup[columnsInGroup.length - 1];
            }

            freezeChecker.addEventListener('change', function(event) {
                var col = lastColumnInGroup ? lastColumnInGroup : that.column;
                var clickedColumnPosition = that.columnController.getDisplayedColumns().indexOf(col);
                if ((<HTMLInputElement>event.target).checked) {
                    clickedColumnPosition++;
                } else if (lastColumnInGroup) {
                    clickedColumnPosition = that.columnController.getDisplayedColumns().indexOf(columnsInGroup[0]);
                }
                that.columnController.setPinnedColumnCount(clickedColumnPosition);

                event.preventDefault();
                event.stopPropagation();
                return false;
            });
            this.eHeaderCell.querySelector('#ag-js-freeze').addEventListener('click', function(event) {
                event.stopPropagation();
            });

            if (lastColumnInGroup && lastColumnInGroup.pinned || this.column.index < this.columnController.getPinnedColumnCount()) {
                (<HTMLInputElement>this.eHeaderCell.querySelector('#ag-js-freeze')).checked = true;
            }
        }

        private useRenderer(headerNameValue: string, headerCellRenderer: Function,
                            headerCellLabel: HTMLElement): void {
            // renderer provided, use it
            var cellRendererParams = {
                colDef: this.column.colDef,
                $scope: this.childScope,
                context: this.gridOptionsWrapper.getContext(),
                value: headerNameValue,
                api: this.gridOptionsWrapper.getApi(),
                eHeaderCell: this.eHeaderCell
            };
            var cellRendererResult = headerCellRenderer(cellRendererParams);
            var childToAppend: any;
            if (_.isNodeOrElement(cellRendererResult)) {
                // a dom node or element was returned, so add child
                childToAppend = cellRendererResult;
            } else {
                // otherwise assume it was html, so just insert
                var eTextSpan = document.createElement("span");
                eTextSpan.innerHTML = cellRendererResult;
                childToAppend = eTextSpan;
            }
            // angular compile header if option is turned on
            if (this.gridOptionsWrapper.isAngularCompileHeaders()) {
                var childToAppendCompiled = this.$compile(childToAppend)(this.childScope)[0];
                headerCellLabel.appendChild(childToAppendCompiled);
            } else {
                headerCellLabel.appendChild(childToAppend);
            }
        }

        public refreshFilterIcon(): void {
            return;
            var filterPresent = this.filterManager.isFilterPresentForCol(this.column.colId);
            if (filterPresent) {
                _.addCssClass(this.eHeaderCell, 'ag-header-cell-filtered');
                this.eFilterIcon.style.display = 'inline';
            } else {
                _.removeCssClass(this.eHeaderCell, 'ag-header-cell-filtered');
                this.eFilterIcon.style.display = 'none';
            }
        }

        public refreshSortIcon(): void {
            // update visibility of icons
            var sortAscending = this.column.sort === constants.ASC;
            var sortDescending = this.column.sort === constants.DESC;
            var unSort = this.column.sort !== constants.DESC && this.column.sort !== constants.ASC;

            if (sortAscending) _.querySelectorAll_replaceCssClass(
                this.getGui(),
                '.pi-ag-header-cell-sort-icon',
                'pi-ag-header-cell-sort-icon-up',
                'pi-ag-header-cell-sort-icon-down'
            );

            if (sortDescending) _.querySelectorAll_replaceCssClass(
                this.getGui(),
                '.pi-ag-header-cell-sort-icon',
                'pi-ag-header-cell-sort-icon-down',
                'pi-ag-header-cell-sort-icon-up'
            );

            if (unSort) {
                _.querySelectorAll_removeCssClass(
                    this.getGui(),
                    '.pi-ag-header-cell-sort-icon',
                    'pi-ag-header-cell-sort-icon-down'
                );                
                _.querySelectorAll_removeCssClass(
                    this.getGui(),
                    '.pi-ag-header-cell-sort-icon',
                    'pi-ag-header-cell-sort-icon-up'
                );                
            }

            return;

            if (this.eSortAsc) {
                _.setVisible(this.eSortAsc, sortAscending);
            }
            if (this.eSortDesc) {
                _.setVisible(this.eSortDesc, sortDescending);
            }
            if (this.eSortNone) {
                _.setVisible(this.eSortNone, unSort);
            }
        }

        private getNextSortDirection(): string {

            var sortingOrder: string[];
            if (this.column.colDef.sortingOrder) {
                sortingOrder = this.column.colDef.sortingOrder;
            } else if (this.gridOptionsWrapper.getSortingOrder()) {
                sortingOrder = this.gridOptionsWrapper.getSortingOrder();
            } else {
                sortingOrder = RenderedHeaderCell.DEFAULT_SORTING_ORDER;
            }

            if ( !Array.isArray(sortingOrder) || sortingOrder.length <= 0) {
                console.warn('ag-grid: sortingOrder must be an array with at least one element, currently it\'s ' + sortingOrder);
                return;
            }

            var currentIndex = sortingOrder.indexOf(this.column.sort);
            var notInArray = currentIndex < 0;
            var lastItemInArray = currentIndex == sortingOrder.length - 1;
            var result: string;
            if (notInArray || lastItemInArray) {
                result = sortingOrder[0];
            } else {
                result = sortingOrder[currentIndex + 1];
            }

            // verify the sort type exists, as the user could provide the sortOrder, need to make sure it's valid
            if (RenderedHeaderCell.DEFAULT_SORTING_ORDER.indexOf(result) < 0) {
                console.warn('ag-grid: invalid sort type ' + result);
                return null;
            }

            return result;
        }

        private addSortHandling(headerCellLabel: HTMLElement) {
            var that = this;

            headerCellLabel.addEventListener("click", function (event: any) {
                var sortDirectionMap: { [s: string]: string; } = {
                    'asc': 'up',
                    'desc': 'down'
                }

                // update sort on current col
                that.column.sort = that.getNextSortDirection();
                if (that.column.sort) {
                    Array.prototype.slice.call(that.eHeaderCell.querySelectorAll('.ag-sort-icon'), 0).forEach(function(el: HTMLElement) {
                        el.classList.remove('active');
                    });
                    that.eHeaderCell.querySelector(`.icon-sort-alpha-${sortDirectionMap[that.column.sort]}`).classList.add('active');
                }


                // sortedAt used for knowing order of cols when multi-col sort
                if (that.column.sort) {
                    that.column.sortedAt = new Date().valueOf();
                } else {
                    that.column.sortedAt = null;
                }

                var doingMultiSort = !that.gridOptionsWrapper.isSuppressMultiSort() && event.shiftKey;

                // clear sort on all columns except this one, and update the icons
                if (!doingMultiSort) {
                    that.columnController.getDisplayedColumns().forEach(function (columnToClear: any) {
                        // Do not clear if either holding shift, or if column in question was clicked
                        if (!(columnToClear === that.column)) {
                            if (columnToClear.sort) {
                                Array.prototype.slice.call(that.eRootRef.querySelector(`.ag-header-cell[colID="${columnToClear.colId}"]`).querySelectorAll('.ag-sort-icon'), 0).forEach(function(el: HTMLElement) {
                                    el.classList.remove('active');
                                });
                            }
                            columnToClear.sort = null;

                        }
                    });
                }

                that.angularGrid.onSortingChanged();
            });
        }

        public onDragStart(): void {
            this.startWidth = this.column.actualWidth;
        }

        public onDragging(dragChange: number, finished: boolean): void {
            var newWidth = this.startWidth + dragChange;
            this.columnController.setColumnWidth(this.column, newWidth, finished);
        }

        public reflowText(elText: HTMLElement, allText: string) {
            //cut text in element adding ellipsis. Element with CSS:
            // text-overflow: ellipsis
            // word-wrap: normal
            // overflow: hidden
            // white-space: normal
            // max-height: 57px - total height
            // line-height: 19px - single line height
            var words = allText.split(' ');
            var overflown = false;
            elText.innerHTML = words[0];

            // find the word thab breaks last allowed line
            for (var i = 1; i < words.length; i++) {
                elText.innerHTML = elText.innerHTML + ' ' + words[i];
                // if (this.column.colId === 'agreementNumber') {
                //     debugger;
                // }
                if (elText.scrollHeight !== elText.clientHeight) {
                    overflown = true;
                    break;
                    // console.log(`broke on ${i} word`);
                }
            }

            // bite out by one char until overflown is gone adding ellipsis to the tail
            if (overflown) {
                // debugger;
                var displayText = elText.innerHTML + '…';
                // console.log(displayText);

                do {

                    do {
                        displayText = displayText.slice(0, -2) + '…';
                    } while (displayText.slice(-2, -1) === ' '); //get rid of tail spaces

                    elText.innerHTML = displayText;
                    // console.log(displayText);

                } while (
                    displayText.length > 1
                    &&
                    elText.scrollHeight !== elText.clientHeight
                );
            } else {
                // console.log('not overflown');
            }

        }

        public onIndividualColumnResized(column: Column) {
            if (this.column !== column || this.lockedForResize) {
                return;
            }
            this.lockedForResize = true;

            var newWidthPx = column.actualWidth + "px";
            this.eHeaderCell.style.width = newWidthPx;

            var elText = this.getGui().querySelector('.ag-header-text');
            var allText = this.columnController.getDisplayNameForCol(this.column);
            this.reflowText(elText, allText);

            this.lockedForResize = false;
        }

        private addHeaderClassesFromCollDef() {
            if (this.column.colDef.headerClass) {
                var classToUse: string | string[];
                if (typeof this.column.colDef.headerClass === 'function') {
                    var params = {
                        colDef: this.column.colDef,
                        $scope: this.childScope,
                        context: this.gridOptionsWrapper.getContext(),
                        api: this.gridOptionsWrapper.getApi()
                    };
                    var headerClassFunc = <(params: any) => string | string[]> this.column.colDef.headerClass;
                    classToUse = headerClassFunc(params);
                } else {
                    classToUse = <string | string[]> this.column.colDef.headerClass;
                }

                if (typeof classToUse === 'string') {
                    _.addCssClass(this.eHeaderCell, classToUse);
                } else if (Array.isArray(classToUse)) {
                    classToUse.forEach((cssClassItem: any): void => {
                        _.addCssClass(this.eHeaderCell, cssClassItem);
                    });
                }
            }
        }

    }

}