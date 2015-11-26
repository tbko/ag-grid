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

        constructor(params: any) {
            console.log(params);

            this.isLayoutPanel = true;

            this.fullHeight = !params.north && !params.south;
            this.deleteListener = params.deleteListener;

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
            this.eCenterWrapper.appendChild(rowOverlayZone);
            rowOverlayZone.addEventListener('click', function(ev) { console.log(ev); });

            this.eOverlayRowWrapper = rowOverlay;
            this.eOverlayRowZoneWrapper = rowOverlayZone;


            // rowOverlayZone.addEventListener('mousemove', this.rowOverlayMouseMoveListener.bind(this));
            rowOverlayZone.addEventListener('mouseleave', this.rowOverlayLeaveListener.bind(this));
            rowOverlayZone.addEventListener('mouseenter', this.rowOverlayEnterListener.bind(this));
        }

        // private rowOverlayMouseMoveListener(event: any): boolean {
        //     var headerTopShift = parseInt(event.target.parentNode.querySelector('.ag-body').style.paddingTop);
        //     // debugger
        //     // var rowElement = _.findParentWithClass(event.target, 'ag-row');
        //     // var bodyElement = _.findParentWithClass(event.target, 'ag-body');
        //     // var overlayElement = this.layout.getOverlayRow();
        //     // var topOffset = parseInt(rowElement.style.top) + parseInt(this.eBody.style.paddingTop);
        //     // overlayElement.style.top = `${topOffset}px`;
        //     // overlayElement.style.height = rowElement.style.height;
        //     return;
        // }

        private rowOverlayLeaveListener(event: any): boolean {
            console.log('leave zone');
            this.eOverlayRowWrapper.style.display = 'none';
            return;
        }

        private rowOverlayEnterListener(event: any): boolean {
            console.log('enter zone');
            this.eOverlayRowWrapper.style.display = '';
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
            this.eOverlayWrapper.style.display = 'none';
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
            var tmpl = `<span>Row Tools</span>`
            return this.getOverlayRowWrapper(tmpl);
        }

        public showOverlayRow() {
            this.eOverlayRowWrapper.style.display = '';
            this.eOverlayRowWrapper.appendChild(
                _.loadTemplate(this.createOverlayRowTemplate().trim())
            );
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
                // this.eOverlayWrapper.getElementsByClassName('k-grid-Delete').onclick = this.deleteListener;
                if (key === 'tool') {
                    elClick = this.eOverlayWrapper.getElementsByClassName('k-grid-Delete')[0];
                    elClick.addEventListener('click', this.deleteListener);
                }
            } else {
                console.log('ag-Grid: unknown overlay');
                this.hideOverlay();
            }
        }

        public setSouthVisible(visible: any) {
            if (this.eSouthWrapper) {
                this.eSouthWrapper.style.display = visible ? '' : 'none';
            }
            this.doLayout();
        }
    }
}

