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

        private rootEl: HTMLElement;
        private containerPinnedEl: HTMLElement;
        private containerBodyEl: HTMLElement;
        private viewportBodyEl: HTMLElement;
        private headerEl: HTMLElement;

        private isLayoutPanel: any;
        private fullHeight: any;
        private layoutActive: any;

        private eGui: any;
        private id: any;
        private name: string;
        private childPanels: any;
        private centerHeightLastTime: any;

        private sizeChangeListeners = <any>[];
        private overlays: any;
        private deleteListener: any;
        private rowActionListener: any;
        private getHoveredOn: any;
        private eventService: EventService;
        private gridOptionsWrapper: GridOptionsWrapper;
        private gridPanel: GridPanel;
        private eBodyViewport;
        private headerHeight;
        private isActionsRedrawn;

        constructor(params: any) {

            this.isLayoutPanel = true;
            this.isActionsRedrawn = true;

            this.fullHeight = !params.north && !params.south;
            this.deleteListener = params.deleteListener;
            this.rowActionListener = params.rowActionListener;
            this.getHoveredOn = params.getHoveredOn;
            this.eventService = params.eventService;
            this.gridOptionsWrapper = params.gridOptionsWrapper;
            this.gridPanel = params.gridPanel;
            this.name = params.name;
            this.eBodyViewport = this.gridPanel ? this.gridPanel.getBodyContainer().parentElement : null;
            this.headerHeight = this.gridOptionsWrapper? this.gridOptionsWrapper.getHeaderHeight() : null;

            var template: any;
            if (!params.dontFill) {
                if (this.fullHeight) {
                    template =
                        '<div style="height: 100%; position: relative;">' +
                        '<div id="west" style="height: 100%; float: left;"></div>' +
                        '<div id="east" style="height: 100%; float: right;"></div>' +
                        '<div id="centerA" style="height: 100%;"></div>' +
                        '<div id="overlay" class="ag-overlay"></div>' +
                        '</div>';
                } else {
                    template =
                        '<div style="height: 100%; position: relative;">' +
                        '<div id="north"></div>' +
                        '<div id="centerRow" style="height: 100%; overflow: hidden;">' +
                        '<div id="west" style="height: 100%; float: left;"></div>' +
                        '<div id="east" style="height: 100%; float: right;"></div>' +
                        '<div id="centerB" style="height: 100%;"></div>' +
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
                    '<div id="centerC"></div>' +
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

            if (params.overlays && this.gridOptionsWrapper.getActionTemplate()) {
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
            this.eCenterWrapper = this.eGui.querySelector('#centerA') || this.eGui.querySelector('#centerB') || this.eGui.querySelector('#centerC');
            this.eOverlayWrapper = this.eGui.querySelector('#overlay');
            this.eCenterRow = this.eGui.querySelector('#centerRow');

            this.eNorthChildLayout = this.setupPanel(params.north, this.eNorthWrapper);
            this.eSouthChildLayout = this.setupPanel(params.south, this.eSouthWrapper);
            this.eEastChildLayout = this.setupPanel(params.east, this.eEastWrapper);
            this.eWestChildLayout = this.setupPanel(params.west, this.eWestWrapper);
            this.eCenterChildLayout = this.setupPanel(params.center, this.eCenterWrapper);

            this.rootEl = this.gridPanel ? this.gridPanel.getRoot() : null;
            if (this.rootEl) {
                this.containerPinnedEl = <HTMLElement>this.rootEl.getElementsByClassName('ag-pinned-cols-container')[0];
                this.viewportBodyEl = <HTMLElement>this.rootEl.getElementsByClassName('ag-body-viewport')[0];
                this.containerBodyEl = <HTMLElement>this.rootEl.getElementsByClassName('ag-body-container')[0];
                this.headerEl = <HTMLElement>this.rootEl.getElementsByClassName('ag-header')[0];
            }
        }

        private addOverlayRowZone(): void {
            var rowOverlay = document.createElement('div');
            rowOverlay.id = 'ag-overlay-row';
            rowOverlay.className = rowOverlay.id;

            var rowOverlayZone = document.createElement('div');
            rowOverlayZone.id = 'ag-overlay-row-zone';
            rowOverlayZone.className = rowOverlayZone.id;

            rowOverlayZone.appendChild(rowOverlay);

            for (let eventName of [
                'click', 'scroll', 'mousemove',
                'mouseup', 'mousedown', 'DOMMouseScroll',
                'MSPointerMove', 'mousewheel', 'wheel',
                'mouseenter', 'mouseleave'
            ]) {
                rowOverlayZone.addEventListener(eventName, this.overlayEventThrough.bind(this));
            }

            rowOverlayZone.addEventListener('mouseleave', this.rowOverlayLeaveListener.bind(this));
            rowOverlayZone.addEventListener('mouseenter', this.rowOverlayEnterListener.bind(this));

            rowOverlay.style.display = 'none';
            this.eOverlayRowWrapper = rowOverlay;
            this.eOverlayRowZoneWrapper = rowOverlayZone;

        }

        public positionOverlayRowZone() {
            console.log('position overlay');
            if (!this.gridOptionsWrapper || !this.getHoveredOn || !this.gridPanel) return;
            // vertically position action row overlay
            // from top of the first fully visible row to bottom of the last visible one
            // right side shift by the width of sroll bar if it is visible

            // viewport where rows and action row zone appears to calculate visibility
            var bodyRect = this.eBodyViewport.getBoundingClientRect();
            var visibleHeight = this.eBodyViewport.clientHeight;

            // rendered rows and their attributes
            var rowsInView = this.gridPanel.rowRenderer.getRenderedRows();
            var rowKeys = Object.keys(rowsInView);
            var firstRenderedIndex = Math.min.apply(null, rowKeys);
            var lastRenderedIndex = Math.max.apply(null, rowKeys);
            var hScrollHeight = this.getScrollHeight();
            
            // result: first/last visible rows and their boundaries
            var eFirstRowEl: HTMLElement;
            var firstRowTop = 0;
            var eLastRowEl: HTMLElement;
            var lastRowBottom = 0;
            var heightDiff = 0;
            var extraTop = 0;
            var extraBottom = 0;

            // it make sense if only there is rendered rows
            if (rowKeys && rowKeys.length) {

                // get elements that occupies first/last pixel in body view (parent of element in this point)
                // if its class is not row one considering first visible row is the first/last rendered one
                [eFirstRowEl, eLastRowEl] = [{
                    pointToCheck: [bodyRect.left, bodyRect.top + 1],
                    fallbackRowIdx: firstRenderedIndex
                }, {
                    pointToCheck: [bodyRect.left, bodyRect.bottom - 1 - hScrollHeight],
                    fallbackRowIdx: lastRenderedIndex
                }].map((params) => {
                    var curEl = <HTMLElement>document.elementFromPoint(...params.pointToCheck);

                    curEl = curEl ? (curEl.parentElement || null) : null;
                    curEl = (curEl && curEl.classList.contains('ag-row')) ? curEl : (
                        rowsInView[params.fallbackRowIdx] ? rowsInView[params.fallbackRowIdx].vBodyRow.element : null
                    );

                    return curEl;
                })

                // get Y coordinate of first visible row; top one if its visible and bottom one if it is mostly hidden
                firstRowTop = eFirstRowEl.offsetTop - this.eBodyViewport.scrollTop;
                if (firstRowTop < 0) {
                    if (firstRowTop > -15) {
                        extraTop = eFirstRowEl.offsetHeight + firstRowTop;
                    }
                    firstRowTop += eFirstRowEl.offsetHeight;
                }
                firstRowTop += this.headerHeight - extraTop;

                // get Y coordinate of last visible row; bottom one if its visible and top one if it is mostly hidden
                lastRowBottom = eLastRowEl.offsetTop - this.eBodyViewport.scrollTop;
                heightDiff = visibleHeight - (lastRowBottom + eLastRowEl.offsetHeight);
                if (heightDiff >= 0) {
                    lastRowBottom += eLastRowEl.offsetHeight;
                } else if (heightDiff > -15) {
                    lastRowBottom += eLastRowEl.offsetHeight + heightDiff;
                }
                lastRowBottom += this.headerHeight;
            }

            this.setRowOverlayTop(firstRowTop);
            this.setRowOverlayHeight(lastRowBottom - firstRowTop);
            this.setRowOverlayRight(this.getScrollWidth());

            // var rowUnderCursor = this.getHoveredOn();
            // if (rowUnderCursor && this.gridPanel.rowRenderer.isListenMouseMove) rowUnderCursor.listenMoveRef();
        }

        public switchExtraButton(rowObj) {
            // var row = this.getOverlayRow();
            var needToShow = (rowObj.node.data.files || []).length;
            var buttonToSwitch = this.eGui.querySelector('#ag-action-row-download');
            if (buttonToSwitch) {
                if (needToShow) {
                    buttonToSwitch.style.display = null;
                } else {
                    buttonToSwitch.style.display = 'none';
                }
            }
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

        private getScrollWidth(): number {
            var el = this.viewportBodyEl;
            return el.getBoundingClientRect().width - el.clientWidth;
        }

        private getScrollHeight(): number {
            var el = this.viewportBodyEl;
            return el.getBoundingClientRect().height - el.clientHeight;
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

            if (this.name != 'eRootPanel' && this.rootEl) {
                var lastHeaderEl = <HTMLElement>this.rootEl.querySelector('.ag-header-container .ag-header-cell:last-child');
                var scrollWidth = this.getScrollWidth();
                
                if (scrollWidth) {
                    lastHeaderEl.style.width = (this.headerEl.offsetWidth - lastHeaderEl.offsetLeft) + 'px';
                }
                var rootWidth = Math.min(
                    this.containerBodyEl.offsetWidth + this.containerPinnedEl.offsetWidth + scrollWidth,
                    this.gridPanel.getRootPanel().offsetWidth
                ) + 'px';

                this.eGui.style.width = rootWidth;
                // this.positionOverlayRowZone();
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

            if (!this.gridPanel) return;

            var totalHeight = _.offsetHeight(this.eGui);
            var northHeight = _.offsetHeight(this.eNorthWrapper);
            var southHeight = _.offsetHeight(this.eSouthWrapper);
            var centerHeight = totalHeight - northHeight - southHeight;

            var compStyleInsertEl: any;

            if (this.gridOptionsWrapper.isHeightUnspecified()) {
                this.eCenterRow.style.height = '100%';

            } else if (this.gridOptionsWrapper.isHeightGiven()) {
                compStyleInsertEl = window.getComputedStyle(
                    <HTMLElement>document.getElementById(this.gridPanel.getId())
                );
                centerHeight = parseInt(compStyleInsertEl.height);
            }

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

        private createOverlayRowTemplate(actions: any[]): string {
            let tmpl: string[] | string = [''];

            if (!actions) {

                actions = this.gridOptionsWrapper.getActionTemplate();
                for (var k in actions) {
                    var v = actions[k];
                    (<string[]>tmpl).push(`
                    <a title="${v}" href="#"><span id="ag-action-row-${k}" class="i-${k}" style="pointer-events:all;"></span></a>
                    `);
                }
                // tmpl = `
                //     <a title="Редактировать" href="#"><span id="ag-action-row-edit" class="i-edit" style="pointer-events:all;"></span></a>
                //     <a title="Удалить" href="#"><span id="ag-action-row-delete" class="i-delete" style="pointer-events:all;"></span></a>
                //     <a title="Разделить" href="#"><span id="ag-action-row-split" class="i-split" style="pointer-events:all;"></span></a>
                // `;

            } else {

                let menuTemplateStart = (data) => {
                    return `
                        <div
                            class="k-visible pi-dropdown-options pi-dropdown-options_hover btn-group k-action-elem_more m-r-sm"
                            style="pointer-events: all;"
                            title=${data.title}
                        >
                            <span
                                class="b-options-btn b-options-btn_icon dropdown-toggle"
                                data-toggle="dropdown"
                                data-hover="dropdown"
                                aria-expanded="false"
                            >
                                <span class="i-${data.code}"> </span>
                            </span>
                            <ul class="dropdown-menu">
                    `;
                }
                var menuTemplateEnd = (data) => {
                    return `
                            </ul>
                        </div>
                    `;
                }
                var menuTemplateItem = (data) => {
                    return `
                        <li>
                            <a class="k-visible k-action-elem js-${data.code}" data-status-id="${data.itemId}" href="\\#">
                                ${data.itemTitle}
                            </a>
                        </li>
                    `;
                }


                for (let actionItem of actions) {
                    let data: any = {
                        title: actionItem.title,
                        code: actionItem.code
                    }

                    if ('children' in actionItem) {
                        (<string[]>tmpl).push(menuTemplateStart(data));

                        for (let menuItem of actionItem.children) {
                            data.itemId = menuItem.get('id');
                            data.itemTitle = menuItem.get('name');
                            (<string[]>tmpl).push(menuTemplateItem(data));
                        }

                        (<string[]>tmpl).push(menuTemplateEnd(data));
                    }

                }


            }
            tmpl = (<string[]>tmpl).join('');
            // template = `
            //     <div
            //         class="k-visible pi-dropdown-options pi-dropdown-options_hover btn-group k-action-elem_more m-r-sm"
            //         style="pointer-events: all;"
            //         title="Смена статуса"
            //     >
            //         <span
            //             class="b-options-btn b-options-btn_icon dropdown-toggle"
            //             data-toggle="dropdown"
            //             data-hover="dropdown"
            //             aria-expanded="false"
            //         >
            //             <span class="i-change-status"> </span>
            //         </span>
            //         <ul class="dropdown-menu">
            //             <li>
            //                 <a class="k-visible k-action-elem js-work-status" data-status-id="9" href="\\#" > Отменена </a>
            //             </li>
            //             <li>
            //                 <a class="k-visible k-action-elem js-work-status" data-status-id="13" href="\\#" > Включена в план ПИ</a>
            //             </li>
            //         </ul>
            //     </div>
            //     <div
            //         class="k-visible pi-dropdown-options pi-dropdown-options_hover btn-group k-action-elem_more m-r-sm"
            //         style="margin-left: -10px; pointer-events: all;"
            //         title="Операции"
            //     >
            //         <span class="b-options-btn dropdown-toggle" data-toggle="dropdown" data-hover="dropdown" aria-expanded="false">...</span>
            //         <ul class="dropdown-menu">
            //             <li>
            //             </li>
            //             <li>
            //                 <a class="link-icon link-edit k-visible k-action-elem js-work-edit" href="#?page=planPIWorks&amp;projectId=150&amp;subpage=edit&amp;id=12544"><span class="content-center">Редактировать</span></a>
            //             </li>
            //             <li>
            //                 <a class="link-icon link-split k-visible k-action-elem js-work-split" href="#?page=planPIWorks&amp;projectId=150&amp;subpage=split&amp;id=12544"><span class="content-center">Разделить</span></a>
            //             </li>
            //             <li>
            //                 <a class="link-icon link-delete k-visible k-action-elem js-work-delete" href="\\#"><span class="content-center">Удалить</span></a>
            //             </li>
            //         </ul>
            //     </div>
            //     <a title="История" href="\\#"><span id="ag-action-row-time-line_md" class="i-time-line_md" style="pointer-events:all;"></span></a>
            // `;
            return this.getOverlayRowWrapper(<string>tmpl);
        }

    // <div class="k-visible pi-dropdown-options btn-group k-action-elem_more" >
    //     <span class="b-options-btn dropdown-toggle" data- toggle="dropdown" data- hover="dropdown" aria- expanded="true" >...</span>
    //         <ul class="dropdown-menu">
    //             <li>
    //             <a class="link-icon link-message k-visible  k-action-elem js-work-message"  href= "\\#" >
    //                 <span class="content-center" >На согласование</span>
    //             </a >
    //             </li>
    //         </ul>
    // </div>



        public showOverlayRow(rowData?: any) {
            if (this.eOverlayRowZoneWrapper === void 0) return;
            var actions: any = this.gridOptionsWrapper.getActionTemplate();
            var actionData: any;

            if (rowData && typeof actions == 'function') {
                // debugger
                actionData = actions({
                    data: rowData,
                    type: 'actionTemplate'
                });
                while (this.eOverlayRowWrapper.firstChild) {
                    this.eOverlayRowWrapper.removeChild(this.eOverlayRowWrapper.firstChild);
                }

                let tempDiv = document.createElement("div");
                tempDiv.innerHTML = this.createOverlayRowTemplate(actionData.actions);
                
                this.eOverlayRowWrapper.appendChild(
                    tempDiv.firstElementChild
                );

                actionData.postActionFn();

                return;
            }

            if (!this.isActionsRedrawn) {
                return;
            }
            this.isActionsRedrawn = false;

            document.querySelector('.ag-body-viewport').appendChild(this.eOverlayRowZoneWrapper);
            // this.eOverlayRowWrapper.style.display = 'none';
            this.eOverlayRowWrapper.appendChild(
                _.loadTemplate(this.createOverlayRowTemplate().trim())
            );
            for (var k in actions) {
                var v = actions[k];
                var that = this;
                (function(k) {
                    var actionElement = that.eOverlayRowWrapper.querySelector(`#ag-action-row-${k}`);
                    if (actionElement) {
                        actionElement.addEventListener('click', (event) => {
                            event.stopPropagation();
                            event.preventDefault();
                            that.rowActionListener(event, k);
                            return false;

                        });
                    }
                })(k);
            }
            // this.eOverlayRowWrapper.querySelector('#ag-action-row-edit').addEventListener('click', (event) => {
            //     event.stopPropagation();
            //     event.preventDefault();
            //     this.rowEditListener(event);
            //     return false; 
            // });
            // this.eOverlayRowWrapper.querySelector('#ag-action-row-delete').addEventListener('click', (event) => {
            //     event.stopPropagation();
            //     event.preventDefault();
            //     this.rowDeleteListener(event);
            //     return false; 
            // });
            // this.eOverlayRowWrapper.querySelector('#ag-action-row-split').addEventListener('click', (event) => {
            //     event.stopPropagation();
            //     event.preventDefault();
            //     this.rowSplitListener(event);
            //     return false; 
            // });
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
            if (this.eOverlayRowZoneWrapper) {
                this.eOverlayRowZoneWrapper.style.top = this.pXhelper(offsetY);
            }
        }

        public setRowOverlayRight(offsetRight: number): void {
            if (this.eOverlayRowZoneWrapper) {
                this.eOverlayRowZoneWrapper.style.right = this.pXhelper(offsetRight);
            }
        }

        public setRowOverlayHeight(height: number): void {
            if (this.eOverlayRowZoneWrapper) {
                this.eOverlayRowZoneWrapper.style.height = this.pXhelper(height);
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

