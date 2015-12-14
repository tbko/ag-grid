/// <reference path='../utils.ts' />
/// <reference path='../filter/filterManager.ts' />
/// <reference path='../gridOptionsWrapper.ts' />
/// <reference path='../columnController.ts' />
/// <reference path='renderedHeaderElement.ts' />

module ag.grid {

    var _ = Utils;
    var constants = Constants;
    var svgFactory = SvgFactory.getInstance();

    export class RenderedHeaderCheckerCell extends RenderedHeaderElement {

        private static DEFAULT_SORTING_ORDER = [constants.ASC, constants.DESC, null];

        // private eRoot: HTMLElement;
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

        private startWidth: number;
        private checkEl: any;

        constructor(column: Column, _:any, parentGroup: RenderedHeaderGroupCell, gridOptionsWrapper: GridOptionsWrapper,
                    parentScope: any, filterManager: FilterManager, columnController: ColumnController,
                    $compile: any, angularGrid: Grid, eRoot: HTMLElement) {
            super(eRoot);
            this.column = column;
            this.parentGroup = parentGroup;
            this.gridOptionsWrapper = gridOptionsWrapper;
            this.parentScope = parentScope;
            this.filterManager = filterManager;
            this.columnController = columnController;
            this.$compile = $compile;
            this.angularGrid = angularGrid;

            this.checkEl = this.setupComponents();
        }

        public toggle(isOnState?: boolean, isSomeState?: boolean): boolean {
            var turnOn = isOnState;
            if (isSomeState) {
                this.checkEl.removeAttribute('checked');
                this.checkEl.checked = false;
                this.checkEl.indeterminate = true;
                return;
            }
            if (turnOn === undefined) {
                turnOn = !this.checkerState();
            }
            if (turnOn) {
                this.checkEl.setAttribute('checked', 'true');
                this.checkEl.indeterminate = false;
                this.checkEl.checked = true;
            } else {
                this.checkEl.removeAttribute('checked');
                this.checkEl.indeterminate = false;
                this.checkEl.checked = false;
            }
            return turnOn;
        }

        private changeSelection(currentState?:boolean) {
            var api = this.gridOptionsWrapper.getApi();
            var desiredState = !this.checkerState();
            if (currentState !== void 0)
                desiredState = currentState;
            if (desiredState) {
                api.selectAll();
            } else {
                api.deselectAll();
            }
        }

        public checkerState(): boolean {
            // return (
            //     this.checkEl.getAttribute('checked')
            // );
            return this.checkEl.checked;
        }

        private setupComponents(): HTMLElement {
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

            // checker element to indicate and to toggle "select all" state
            var eCheckBoxInput = document.createElement("input");
            eCheckBoxInput.id = this.angularGrid.getId() + '-checker-header';
            eCheckBoxInput.name = this.angularGrid.getId() + '-checker-header';
            eCheckBoxInput.type = 'checkbox';
            eCheckBoxInput.addEventListener('click', function(e: any) {
                // change select all on checker click
                e.stopPropagation();
                that.changeSelection(this.checked);
            });
            
            // checker element Xmas decorations template
            var eCheckBoxIcon = document.createElement("span");
            eCheckBoxIcon.className = 'input-icon';
            var eCheckBoxSpan = document.createElement("span");
            eCheckBoxSpan.className = 'checkbox-input';
            
            // !!!!!!!TODO: shift style to css
            eCheckBoxSpan.style.textAlign = 'left';
            
            eCheckBoxSpan.appendChild(eCheckBoxInput);
            eCheckBoxSpan.appendChild(eCheckBoxIcon);
            var eCheckBoxLabel = document.createElement("label");
            eCheckBoxLabel.appendChild(eCheckBoxSpan);
            var eCheckBox = document.createElement("div");
            eCheckBox.className = "pi-btn-checkbox";
            eCheckBox.appendChild(eCheckBoxLabel);
            // label div
            var headerCellLabel = document.createElement("div");
            headerCellLabel.className = "ag-header-cell-label group-checkbox";
            // headerCellLabel.setAttribute('role', 'gridcell');
            headerCellLabel.appendChild(eCheckBox);

            // append header template into header cell element
            this.eHeaderCell.appendChild(headerCellLabel);
            this.eHeaderCell.style.width = _.formatWidth(this.column.actualWidth);
            this.eHeaderCell.addEventListener('click', function(e) {
                // change select all on click in header area
                that.changeSelection();
            });

            return eCheckBoxInput;
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