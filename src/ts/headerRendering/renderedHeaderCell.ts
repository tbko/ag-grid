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

        constructor(column: Column, parentGroup: RenderedHeaderGroupCell, gridOptionsWrapper: GridOptionsWrapper,
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
            if (this.gridOptionsWrapper.isGroupHeaders()) {
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

            this.createScope();
            this.addClasses();
            this.addAttributes();
            this.addHeaderClassesFromCollDef();

            // add tooltip if exists
            if (this.column.colDef.headerTooltip) {
                this.eHeaderCell.title = this.column.colDef.headerTooltip;
            }

            if (this.gridOptionsWrapper.isEnableColResize() && !this.column.colDef.suppressResize) {
                var headerCellResize = document.createElement("div");
                headerCellResize.className = "ag-header-cell-resize";
                this.eHeaderCell.appendChild(headerCellResize);
                this.addDragHandler(headerCellResize);
            }

            // this.addMenu();

            // label div
            var headerCellLabel = document.createElement("div");
            headerCellLabel.className = "ag-header-cell-label";

            // add in sort icons
            // this.addSortIcons(headerCellLabel);


            // add in filter icon
            // this.eFilterIcon = _.createIcon('filter', this.gridOptionsWrapper, this.column, svgFactory.createFilterSvg);
            // _.addCssClass(this.eFilterIcon, 'ag-header-icon');
            // headerCellLabel.appendChild(this.eFilterIcon);

            // render the cell, use a renderer if one is provided
            var headerCellRenderer: any;
            if (this.column.colDef.headerCellRenderer) { // first look for a renderer in col def
                headerCellRenderer = this.column.colDef.headerCellRenderer;
            } else if (this.gridOptionsWrapper.getHeaderCellRenderer()) { // second look for one in grid options
                headerCellRenderer = this.gridOptionsWrapper.getHeaderCellRenderer();
            }

            var headerNameValue = this.columnController.getDisplayNameForCol(this.column);

            if (headerCellRenderer) {
                this.useRenderer(headerNameValue, headerCellRenderer, headerCellLabel);
            } else {
                // no renderer, default text render
                var eInnerText = document.createElement("span");
                eInnerText.className = 'ag-header-cell-text';
                eInnerText.innerHTML = headerNameValue;
                headerCellLabel.appendChild(eInnerText);
            }

            this.eHeaderCell.appendChild(headerCellLabel);
            this.eHeaderCell.style.width = _.formatWidth(this.column.actualWidth);

            var dragHandler = this.eHeaderCell.querySelector('.ag-js-draghandler');
            if (dragHandler) this.setupDND(dragHandler);

            this.addSortHandling(this.eHeaderCell);

            var freezeChecker = this.eHeaderCell.querySelector('#ag-js-freeze');
            if (freezeChecker) this.setupFreeze(freezeChecker);
        }

        private isNogroupSamegroup(el: HTMLElement): boolean {
            // debugger
            if (
                !this.column.colDef.headerGroup &&
                !targetCol.colDef.headerGroup
            ) {
                return true;
            }
            var targetColId = el.getAttribute('colId');
            var targetCol = this.columnController.getColumn(targetColId);
            return this.column.colDef.headerGroup === targetCol.colDef.headerGroup;
        }

        private setupDND(dragHandler: Element) {
            var that = this;
            // start/storp dragging header
            dragHandler.setAttribute('draggable', 'true');
            dragHandler.addEventListener('dragstart', function(event: DragEvent) {
                that.eHeaderCell.classList.add('ag-dragging');
                event.dataTransfer.setData('text/plain', that.column.colId);
            });
            dragHandler.addEventListener('dragover', function(event: DragEvent) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
            });
            dragHandler.addEventListener('dragend', function() {
                that.eHeaderCell.classList.remove('ag-dragging');
            });

            // react to drag header over header
            var lastenter: any;
            var dragEnterHandler = (event: Event) => {

                console.log(lastenter);
                console.log(that.eHeaderCell.classList.contains('ag-dragging'));
                console.log(that.isNogroupSamegroup.call(that, <HTMLElement>event.currentTarget));

                if (
                    !lastenter &&
                    !that.eHeaderCell.classList.contains('ag-dragging') &&
                    that.isNogroupSamegroup.call(that, <HTMLElement>event.currentTarget)
                )
                    that.eHeaderCell.classList.add('ag-dragging-over');

                lastenter = event.target;
                event.stopPropagation();
                event.preventDefault();
                return false;
            };
            var dragLeaveHandler = (event: Event) => {
                if (lastenter === event.target) {
                    // console.log('left');
                    that.eHeaderCell.classList.remove('ag-dragging-over');
                    lastenter = null;
                }
            };
            this.eHeaderCell.addEventListener('dragenter', dragEnterHandler);
            this.eHeaderCell.addEventListener('dragleave', dragLeaveHandler);

            // swap columns on drop
            this.eHeaderCell.addEventListener('drop', function(event:DragEvent) {
                var sourceIndex = that.columnController.getAllColumns().indexOf(
                    that.columnController.getColumn(event.dataTransfer.getData('text/plain'))
                );
                var destinationIndex = that.columnController.getAllColumns().indexOf(
                    that.column
                );
                that.columnController.moveColumn(sourceIndex, destinationIndex);

                event.stopPropagation();
                event.preventDefault();
                return false;
            });
        }

        private setupFreeze(freezeChecker: Element) {
            var that = this;

            freezeChecker.addEventListener('change', function(event) {
                var clickedColumnPosition = that.columnController.getDisplayedColumns().indexOf(that.column);
                if ((<HTMLInputElement>event.target).checked) {
                    clickedColumnPosition++;
                }
                that.columnController.setPinnedColumnCount(clickedColumnPosition);
                event.preventDefault();
                event.stopPropagation();
                return false;
            });
            this.eHeaderCell.querySelector('#ag-js-freeze').addEventListener('click', function(event) {
                event.stopPropagation();
            });

            if (this.column.index < this.columnController.getPinnedColumnCount()) {
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

        public onIndividualColumnResized(column: Column) {
            if (this.column !== column) {
                return;
            }
            var newWidthPx = column.actualWidth + "px";
            this.eHeaderCell.style.width = newWidthPx;
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