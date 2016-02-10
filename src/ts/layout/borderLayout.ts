/// <reference path="../utils.ts" />

module ag.grid {

    var _ = Utils;

    export class BorderLayout {

        private eNorthWrapper: any;
        private eSouthWrapper: any;
        private eEastWrapper: any;
        private eWestWrapper: any;
        private eCenterWrapper: any;
        private eOverlayWrapper: any;
        private eOverlayRowWrapper: any;
        private eOverlayRowZoneWrapper: any;
        private eToolOverlayWrapper: any;
        private eCenterRow: any;

        private eNorthChildLayout: any;
        private eSouthChildLayout: any;
        private eEastChildLayout: any;
        private eWestChildLayout: any;
        private eCenterChildLayout: any;

        private isLayoutPanel: any;
        private fullHeight: any;
        private layoutActive: any;

        private eGui: any;
        private id: any;
        private childPanels: any;
        private centerHeightLastTime: any;

        private sizeChangeListeners = <any>[];
        private overlays: any;
        private deleteListener: any;
        private rowEditListener: any;
        private rowDeleteListener: any;
        private rowSplitListener: any;
        private eventService: EventService;
        private gridOptionsWrapper: GridOptionsWrapper;
        private gridPanel: GridPanel;

        constructor(params: any) {

            this.isLayoutPanel = true;

            this.fullHeight = !params.north && !params.south;
            this.deleteListener = params.deleteListener;
            this.rowEditListener = params.rowEditListener;
            this.rowDeleteListener = params.rowDeleteListener;
            this.rowSplitListener = params.rowSplitListener;
            this.eventService = params.eventService;
            this.gridOptionsWrapper = params.gridOptionsWrapper;
            this.gridPanel = params.gridPanel;

            var template: any;
            if (!params.dontFill) {
                if (this.fullHeight) {
                    template =
                        '<div style="height: 100%; overflow: auto; position: relative;">' +
                        '<div id="west" style="height: 100%; float: left;"></div>' +
                        '<div id="east" style="height: 100%; float: right;"></div>' +
                        '<div id="center" style="height: 100%;"></div>' +
                        '<div id="overlay" class="ag-overlay"></div>' +
                        '</div>';
                } else {
                    template =
                        '<div style="height: 100%; position: relative;">' +
                        '<div id="north"></div>' +
                        '<div id="centerRow" style="height: 100%; overflow: hidden;">' +
                        '<div id="west" style="height: 100%; float: left;"></div>' +
                        '<div id="east" style="height: 100%; float: right;"></div>' +
                        '<div id="center" style="height: 100%;"></div>' +
                        '</div>' +
                        '<div id="south"></div>' +
                        '<div id="overlay" class="ag-overlay"></div>' +
                        '</div>';
                }
                this.layoutActive = true;
            } else {
                template =
                    '<div style="position: relative;">' +
                    '<div id="north"></div>' +
                    '<div id="centerRow">' +
                    '<div id="west"></div>' +
                    '<div id="east"></div>' +
                    '<div id="center"></div>' +
                    '</div>' +
                    '<div id="south"></div>' +
                    '<div id="overlay" style="pointer-events: none; position: absolute; height: 100%; width: 100%; top: 0px; left: 0px;"></div>' +
                    '</div>';
                this.layoutActive = false;
            }

            this.eGui = _.loadTemplate(template);

            this.id = 'borderLayout';
            if (params.name) {
                this.id += '_' + params.name;
            }
            this.eGui.setAttribute('id', this.id);
            this.childPanels = [];

            if (params) {
                this.setupPanels(params);
            }

            if (params.overlays) {
                this.addOverlayRowZone();
            }

            this.overlays = params.overlays;
            this.setupOverlays();

            
            // this.eGui.style.width = '1630px';
            // document.getElementsByClassName('work-space-content-body')[0].offsetWidth + 'px';
            // console.log(document.getElementsByClassName('work-space-content-body')[0].offsetWidth + 'px');
        }

        public getOverlays() {
            return this.overlays;
        }

        public getOverlayRow() {
            return this.eOverlayRowWrapper;
        }

        public getOverlayRowZone() {
            return this.eOverlayRowZoneWrapper;
        }

        public addSizeChangeListener(listener: Function): void {
            this.sizeChangeListeners.push(listener);
        }

        public fireSizeChanged(): void {
            this.sizeChangeListeners.forEach( function(listener: Function) {
                listener();
            });
        }

        private setupPanels(params: any) {
            this.eNorthWrapper = this.eGui.querySelector('#north');
            this.eSouthWrapper = this.eGui.querySelector('#south');
            this.eEastWrapper = this.eGui.querySelector('#east');
            this.eWestWrapper = this.eGui.querySelector('#west');
            this.eCenterWrapper = this.eGui.querySelector('#center');
            this.eOverlayWrapper = this.eGui.querySelector('#overlay');
            this.eCenterRow = this.eGui.querySelector('#centerRow');

            this.eNorthChildLayout = this.setupPanel(params.north, this.eNorthWrapper);
            this.eSouthChildLayout = this.setupPanel(params.south, this.eSouthWrapper);
            this.eEastChildLayout = this.setupPanel(params.east, this.eEastWrapper);
            this.eWestChildLayout = this.setupPanel(params.west, this.eWestWrapper);
            this.eCenterChildLayout = this.setupPanel(params.center, this.eCenterWrapper);


        }

        private addOverlayRowZone(): void {
            var rowOverlay = document.createElement('div');
            rowOverlay.id = 'ag-overlay-row';
            rowOverlay.className = rowOverlay.id;

            var rowOverlayZone = document.createElement('div');
            rowOverlayZone.id = 'ag-overlay-row-zone';
            rowOverlayZone.className = rowOverlayZone.id;

            rowOverlayZone.appendChild(rowOverlay);

            
            // rowOverlayZone.style.top = `${this.gridOptionsWrapper.getFullHeaderHeight()}px`;

            rowOverlayZone.addEventListener('click', this.overlayEventThrough.bind(this));
            rowOverlayZone.addEventListener('scroll', this.overlayEventThrough.bind(this));
            rowOverlayZone.addEventListener('mousemove', this.overlayEventThrough.bind(this));
            rowOverlayZone.addEventListener('DOMMouseScroll', this.overlayEventThrough.bind(this));
            rowOverlayZone.addEventListener('mousewheel', this.overlayEventThrough.bind(this));


            rowOverlayZone.addEventListener('mouseleave', this.rowOverlayLeaveListener.bind(this));
            rowOverlayZone.addEventListener('mouseenter', this.rowOverlayEnterListener.bind(this));

            rowOverlay.style.display = 'none';
            this.eOverlayRowWrapper = rowOverlay;
            this.eOverlayRowZoneWrapper = rowOverlayZone;

        }

        public positionOverlayRowZone(offsetTopY: number) {

            var eBodyViewport = this.gridPanel.getBodyContainer();
            var headerHeight = this.gridOptionsWrapper.getHeaderHeight();
            var rowOverlayOffset = headerHeight - offsetTopY;
            // var rowOverlayOffset = headerHeight;
            var rowOverlayHeight = offsetTopY + eBodyViewport.clientHeight;
            // console.log(offsetTopY);
            // console.log(eBodyViewport.clientHeight);
            // console.log(offsetTopY + eBodyViewport.clientHeight);
            // console.log('***');

            var rightGap = this.gridPanel.getRightGap();
            var rightPosition = rightGap > 0 ? rightGap : 18;

            this.setRowOverlayTop(rowOverlayOffset);
            this.setRowOverlayRowHeight(rowOverlayHeight);            
            this.setRowOverlayRight(rightPosition);
        }

        private overlayEventThrough(event: MouseEvent) {
            // relay mouse events to underlying element
            var coordinates: any;
            (<HTMLElement>event.target).style.display = 'none';
            if (event.clientX) {
                coordinates = {
                    pointerX: event.clientX,
                    pointerY: event.clientY
                }
            }
            var underEl = document.elementFromPoint(event.clientX, event.clientY);
            // console.log(underEl);
            if (underEl) _.simulateEvent((<HTMLElement>underEl), event.type, coordinates);
            (<HTMLElement>event.target).style.display = '';
        }

        private rowOverlayLeaveListener(event: any): boolean {
            // stop processing overlay when move out of zone
            this.eOverlayRowWrapper.style.display = 'none';
            this.eventService.dispatchEvent(Events.EVENT_ALL_ROWS_STOP_LISTEN_MOUSE_MOVE);
            return;
        }

        private rowOverlayEnterListener(event: any): boolean {
            (<HTMLElement>event.target).style.display = 'none';
            var underEl = document.elementFromPoint(event.clientX, event.clientY);
            var emptySpaceUnder = underEl.classList.contains('ag-body-viewport');
            (<HTMLElement>event.target).style.display = '';
            if (emptySpaceUnder) {
                console.log('empty');
                return;
            }
            // start processing overlay when move into zone
            this.eOverlayRowWrapper.style.display = '';
            this.eventService.dispatchEvent(Events.EVENT_ALL_ROWS_LISTEN_MOUSE_MOVE);
            return;
        }


        private setupPanel(content: any, ePanel: any) {
            if (!ePanel) {
                return;
            }
            if (content) {
                if (content.isLayoutPanel) {
                    this.childPanels.push(content);
                    ePanel.appendChild(content.getGui());
                    return content;
                } else {
                    ePanel.appendChild(content);
                    return null;
                }
            } else {
                ePanel.parentNode.removeChild(ePanel);
                return null;
            }
        }

        public getGui() {
            return this.eGui;
        }

        // returns true if any item changed size, otherwise returns false
        public doLayout() {

            if (!_.isVisible(this.eGui)) {
                return false;
            }

            var atLeastOneChanged = false;

            var childLayouts = [this.eNorthChildLayout, this.eSouthChildLayout, this.eEastChildLayout, this.eWestChildLayout];
            var that = this;
            _.forEach(childLayouts, function (childLayout: any) {
                var childChangedSize = that.layoutChild(childLayout);
                if (childChangedSize) {
                    atLeastOneChanged = true;
                }
            });

            if (this.layoutActive) {
                var ourHeightChanged = this.layoutHeight();

                var ourWidthChanged = this.layoutWidth();
                if (ourHeightChanged || ourWidthChanged) {
                    atLeastOneChanged = true;
                }
            }

            var centerChanged = this.layoutChild(this.eCenterChildLayout);
            if (centerChanged) {
                atLeastOneChanged = true;
            }

            if (atLeastOneChanged) {
                this.fireSizeChanged();
            }

            // var rootWidth = document.getElementsByClassName('b-content-center')[0].offsetWidth + 'px';
            // this.eGui.style.width = rootWidth;
            this.eGui.style.width = '1300px';
            // this.eGui.style.width = '1620px';
            // debugger;

            return atLeastOneChanged;
        }

        private layoutChild(childPanel: any) {
            if (childPanel) {
                return childPanel.doLayout();
            } else {
                return false;
            }
        }

        private layoutHeight() {
            if (this.fullHeight) {
                return this.layoutHeightFullHeight();
            } else {
                return this.layoutHeightNormal();
            }
        }

        // full height never changes the height, because the center is always 100%,
        // however we do check for change, to inform the listeners
        private layoutHeightFullHeight() {
            var centerHeight = _.offsetHeight(this.eGui);
            if (centerHeight < 0) {
                centerHeight = 0;
            }
            if (this.centerHeightLastTime !== centerHeight) {
                this.centerHeightLastTime = centerHeight;
                return true;
            } else {
                return false;
            }
        }

        private layoutHeightNormal() {

            var totalHeight = _.offsetHeight(this.eGui);
            var northHeight = _.offsetHeight(this.eNorthWrapper);
            var southHeight = _.offsetHeight(this.eSouthWrapper);

            var centerHeight = totalHeight - northHeight - southHeight;
            if (centerHeight < 0) {
                centerHeight = 0;
            }

            if (this.centerHeightLastTime !== centerHeight) {
                this.eCenterRow.style.height = centerHeight + 'px';
                this.centerHeightLastTime = centerHeight;
                return true; // return true because there was a change
            } else {
                return false;
            }
        }

        public getCentreHeight(): number {
            return this.centerHeightLastTime;
        }

        private layoutWidth() {
            var totalWidth = _.offsetWidth(this.eGui);
            var eastWidth = _.offsetWidth(this.eEastWrapper);
            var westWidth = _.offsetWidth(this.eWestWrapper);

            var centerWidth = totalWidth - eastWidth - westWidth;
            if (centerWidth < 0) {
                centerWidth = 0;
            }

            // console.log(this.eGui);
            // console.log(totalWidth);

            this.eCenterWrapper.style.width = centerWidth + 'px';
        }

        public setEastVisible(visible: any) {
            if (this.eEastWrapper) {
                this.eEastWrapper.style.display = visible ? '' : 'none';
            }
            this.doLayout();
        }

        private setupOverlays(): void {
            // if no overlays, just remove the panel
            if (!this.overlays) {
                this.eOverlayWrapper.parentNode.removeChild(this.eOverlayWrapper);
                return;
            }

            this.hideOverlay();
            //
            //this.setOverlayVisible(false);
        }

        public hideOverlay() {
            _.removeAllChildren(this.eOverlayWrapper);
            // this.eOverlayWrapper.style.display = 'none';
        }

        private getOverlayRowWrapper(content: string = '') {
            var tmpl = `
                <div class="ag-overlay-panel">
                    <div class="ag-overlay-wrapper ag-overlay-row-wrapper">${content}</div>
                </div>
            `;
            return tmpl;
        }

        private createOverlayRowTemplate(): string {
            var tmpl = `
                <a title="Редактировать" href="#"><span id="ag-action-row-edit" class="i-edit" style="pointer-events:all;"></span></a>
                <a title="Удалить" href="#"><span id="ag-action-row-delete" class="i-delete" style="pointer-events:all;"></span></a>
                <a title="Разделить" href="#"><span id="ag-action-row-split" class="i-split" style="pointer-events:all;"></span></a>
            `;
            return this.getOverlayRowWrapper(tmpl);
        }

        public showOverlayRow() {
            if (this.eOverlayRowZoneWrapper === void 0) return;
            document.querySelector('.ag-body-viewport').appendChild(this.eOverlayRowZoneWrapper);
            // this.eOverlayRowWrapper.style.display = 'none';
            this.eOverlayRowWrapper.appendChild(
                _.loadTemplate(this.createOverlayRowTemplate().trim())
            );
            this.eOverlayRowWrapper.querySelector('#ag-action-row-edit').addEventListener('click', (event) => {
                event.stopPropagation();
                event.preventDefault();
                this.rowEditListener(event);
                return false; 
            });
            this.eOverlayRowWrapper.querySelector('#ag-action-row-delete').addEventListener('click', (event) => {
                event.stopPropagation();
                event.preventDefault();
                this.rowDeleteListener(event);
                return false; 
            });
            this.eOverlayRowWrapper.querySelector('#ag-action-row-split').addEventListener('click', (event) => {
                event.stopPropagation();
                event.preventDefault();
                this.rowSplitListener(event);
                return false; 
            });
        }

        public showOverlay(key: string) {
            var overlay = this.overlays ? this.overlays[key] : null;
            var elClick: any;
            if (overlay) {
                _.removeAllChildren(this.eOverlayWrapper);
                if (key === 'tool') {
                    this.eOverlayWrapper.classList.remove('ag-overlay');
                    this.eOverlayWrapper.classList.add('ag-overlay-tool');
                }
                this.eOverlayWrapper.style.display = '';
                this.eOverlayWrapper.appendChild(overlay);
                if (key === 'tool') {
                    elClick = this.eOverlayWrapper.getElementsByClassName('k-grid-Delete')[0];
                    elClick.addEventListener('click', this.deleteListener);
                }
            } else {
                console.log('ag-Grid: unknown overlay');
                this.hideOverlay();
            }
        }

        private pXhelper(value: number): string {
            return `${value}px`
        }

        public setRowOverlayTop(offsetY: number): void {
            this.eOverlayRowZoneWrapper.style.top = this.pXhelper(offsetY);
        }

        public setRowOverlayRight(offsetRight: number): void {
            this.eOverlayRowZoneWrapper.style.right = this.pXhelper(offsetRight);
        }

        public setRowOverlayRowHeight(height: number): void {
            this.eOverlayRowZoneWrapper.style.height = this.pXhelper(height);
        }

        public setSouthVisible(visible: any) {
            if (this.eSouthWrapper) {
                this.eSouthWrapper.style.display = visible ? '' : 'none';
            }
            this.doLayout();
        }
    }
}

