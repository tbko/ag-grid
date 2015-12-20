/// <reference path="../utils.ts" />
/// <reference path="../constants.ts" />
/// <reference path="../svgFactory.ts" />
/// <reference path="../headerRendering/renderedHeaderElement.ts" />
/// <reference path="../headerRendering/renderedHeaderCell.ts" />
/// <reference path="../headerRendering/renderedHeaderCheckerCell.ts" />
/// <reference path="../headerRendering/renderedHeaderGroupCell.ts" />
/// <reference path="../dragAndDrop/dragAndDropService" />
/// <reference path="../widgets/agPopupService.ts" />

module ag.grid {

    var utils = Utils;

    enum DropTargetLocation { NOT_DROP_TARGET, DROP_TARGET_ABOVE, DROP_TARGET_BELOW };

    export class HeaderRenderer {

        private gridOptionsWrapper: GridOptionsWrapper;
        private columnController: ColumnController;
        private angularGrid: Grid;
        private filterManager: FilterManager;
        private $scope: any;
        private $compile: any;
        private ePinnedHeader: HTMLElement;
        private eHeaderContainer: HTMLElement;
        private eRoot: HTMLElement;

        private headerElements: RenderedHeaderElement[] = [];

        private readOnly: boolean;
        private dragAndDropService: DragAndDropService;
        private popupService: PopupService;
        private uniqueId: any;

        public init(gridOptionsWrapper: GridOptionsWrapper, columnController: ColumnController, gridPanel: GridPanel,
            angularGrid: Grid, filterManager: FilterManager, $scope: any, $compile: any, dragAndDropService: DragAndDropService, popUpService: PopupService) {

            this.gridOptionsWrapper = gridOptionsWrapper;
            this.columnController = columnController;
            this.angularGrid = angularGrid;
            this.filterManager = filterManager;
            this.$scope = $scope;
            this.$compile = $compile;
            this.findAllElements(gridPanel);

            this.readOnly = false;
            this.dragAndDropService = dragAndDropService;
            this.popupService = popUpService;
            this.uniqueId = 'ColumnDrag-' + Math.random();
        }

        // start drag-n-drop methods

        public getUniqueId() {
            return this.uniqueId;
        }

        private addDragAndDropToListItem(eDragHandler: any, item: any) {
            // debugger
            var that = this;
            // eListItem.addEventListener('dragstart', function(ev: any) { console.log(ev);})
            // var eCell = eListItem.querySelector('.b-content-center');
            this.dragAndDropService.addDragSource(eDragHandler, {
                getData: function() {
                    return item;
                },
                getContainerId: function() {
                    return that.uniqueId;
                }
            });
            this.dragAndDropService.addDropTarget(item, {
                acceptDrag: function(dragItem: any) {
                    return that.internalAcceptDrag(item, dragItem, eDragHandler);
                },
                drop: function(dragItem: any) {
                    that.internalDrop(item, dragItem.data);
                },
                noDrop: function() {
                    that.internalNoDrop(eDragHandler);
                }
            });
        }

        private internalAcceptDrag(targetColumn: any, dragItem: any, eListItem: any) {
            return true;
            var result = dragItem.data !== targetColumn && dragItem.containerId === this.uniqueId;
            if (result) {
                if (this.dragAfterThisItem(targetColumn, dragItem.data)) {
                    this.setDropCssClasses(eListItem, DropTargetLocation.DROP_TARGET_ABOVE);
                } else {
                    this.setDropCssClasses(eListItem, DropTargetLocation.DROP_TARGET_BELOW);
                }
            }
            return result;
        }

        private internalDrop(targetColumn: any, draggedColumn: any) {
            return;
            // debugger;
            var oldIndex = this.headerElements.indexOf(draggedColumn);
            var newIndex = this.headerElements.indexOf(targetColumn);

            // if (this.readOnly) {
            //     this.fireItemMoved(oldIndex, newIndex);
            // } else {
                // this.headerElements.splice(oldIndex, 1);
                // this.headerElements.splice(newIndex, 0, draggedColumn);

                // this.refreshHeader();
                // this.fireModelChanged();
            this.columnController.moveColumn(oldIndex, newIndex);

            // }
        }

        private internalNoDrop(eListItem: any) {
            return;
            this.setDropCssClasses(eListItem, DropTargetLocation.NOT_DROP_TARGET);
        }

        private dragAfterThisItem(targetColumn: any, draggedColumn: any) {
            return this.headerElements.indexOf(targetColumn) < this.headerElements.indexOf(draggedColumn);
        }

        private setDropCssClasses(eListItem: any, state: any) {
            utils.addOrRemoveCssClass(eListItem, 'ag-not-drop-target', state === DropTargetLocation.NOT_DROP_TARGET);
            utils.addOrRemoveCssClass(eListItem, 'ag-drop-target-above', state === DropTargetLocation.DROP_TARGET_ABOVE);
            utils.addOrRemoveCssClass(eListItem, 'ag-drop-target-below', state === DropTargetLocation.DROP_TARGET_BELOW);
        }

        // end drag-n-drop methods

        private findAllElements(gridPanel: GridPanel) {
            this.ePinnedHeader = gridPanel.getPinnedHeader();
            this.eHeaderContainer = gridPanel.getHeaderContainer();
            this.eRoot = gridPanel.getRoot();
        }

        public refreshHeader() {
            utils.removeAllChildren(this.ePinnedHeader);
            utils.removeAllChildren(this.eHeaderContainer);

            this.headerElements.forEach( (headerElement: RenderedHeaderElement) => {
                headerElement.destroy();
            });
            this.headerElements = [];

            if (this.gridOptionsWrapper.isGroupHeaders()) {
                this.insertHeadersWithGrouping();
            } else {
                this.insertHeadersWithoutGrouping();
            }
        }

        private insertHeadersWithGrouping() {
            var groups: ColumnGroup[] = this.columnController.getHeaderGroups();
            groups.forEach( (columnGroup: ColumnGroup) => {
                var renderedHeaderGroup = new RenderedHeaderGroupCell(columnGroup, this.gridOptionsWrapper,
                    this.columnController, this.eRoot, this.angularGrid, this.$scope,
                    this.filterManager, this.$compile);
                this.headerElements.push(renderedHeaderGroup);
                var eContainerToAddTo = columnGroup.pinned ? this.ePinnedHeader : this.eHeaderContainer;
                eContainerToAddTo.appendChild(renderedHeaderGroup.getGui());
                // renderedHeaderGroup.children.forEach((headerRenderer: RenderedHeaderCell) => {
                //     // debugger;
                //     if (headerRenderer.column.colId !== 'checkbox') {
                //         console.log(headerRenderer.getGui().querySelector('.ag-header-text').clientHeight);
                //         headerRenderer.reflowText(
                //             headerRenderer.getGui().querySelector('.ag-header-text'),
                //             this.columnController.getDisplayNameForCol(headerRenderer.column)
                //         );
                //     }
                // });
            });
        }

        public toggleSelectAll(pamparams: any) {
            // toggle header state for all checker columns
            this.headerElements.forEach( (headerElement: any) => {
                if (headerElement && headerElement.column && headerElement.column.colDef.checkboxSelection) {
                    headerElement.toggle(pamparams.allSelected, pamparams.someSelected);
                }
                if (headerElement && headerElement.columnGroup) {
                    headerElement.children.forEach(function(groupedElement: any) {
                        if (groupedElement.column && groupedElement.column.colDef && groupedElement.column.colDef.checkboxSelection) {
                            groupedElement.toggle(pamparams.allSelected, pamparams.someSelected);
                        }
                    });
                }
            });
        }

        private insertHeadersWithoutGrouping() {
            this.columnController.getDisplayedColumns().forEach( (column: Column) => {
                // only include the first x cols
                var headerCellRenderer: any = RenderedHeaderCell;
                if (column.colDef.checkboxSelection) {
                    headerCellRenderer = RenderedHeaderCheckerCell;
                }
                var renderedHeaderCell = new headerCellRenderer(column, {
                    'frame': true,
                    'sort': true,
                    'freeze': true,
                    'resize': true,
                    'drag': true                    
                }, null, this.gridOptionsWrapper,
                    this.$scope, this.filterManager, this.columnController, this.$compile,
                    this.angularGrid, this.eRoot, this.popupService);
                this.headerElements.push(renderedHeaderCell);
                var eContainerToAddTo = column.pinned ? this.ePinnedHeader : this.eHeaderContainer;
                eContainerToAddTo.appendChild(renderedHeaderCell.getGui());
                // var elText = renderedHeaderCell.getGui().querySelector('.ag-header-text');
                // var allText = this.columnController.getDisplayNameForCol(renderedHeaderCell.column);
                // renderedHeaderCell.reflowText(elText, allText);
            });
        }

        public updateSortIcons() {
            this.headerElements.forEach( (headerElement: RenderedHeaderElement) => {
                headerElement.refreshSortIcon();
            });
        }

        public updateFilterIcons() {
            this.headerElements.forEach( (headerElement: RenderedHeaderElement) => {
                headerElement.refreshFilterIcon();
            });
        }

        public onIndividualColumnResized(column: Column): void {
            this.headerElements.forEach( (headerElement: RenderedHeaderElement) => {
                headerElement.onIndividualColumnResized(column);
            });
        }
    }
}
