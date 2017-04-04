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
                'click', 'scroll', 'mousemove', 'mouseover',
                'mouseup', 'mousedown', 'DOMMouseScroll',
                'MSPointerMove', 'mousewheel', 'wheel',
                'mouseenter', 'mouseleave'
            ]) {
                rowOverlayZone.addEventListener(eventName, this.overlayEventThrough.bind(this));
            }
            // rowOverlayZone.addEventListener('mouseover', (ev) => { console.log(ev);});

            rowOverlayZone.addEventListener('mouseleave', this.rowOverlayLeaveListener.bind(this));
            rowOverlayZone.addEventListener('mouseenter', this.rowOverlayEnterListener.bind(this));

            rowOverlay.style.display = 'none';
            this.eOverlayRowWrapper = rowOverlay;
            this.eOverlayRowZoneWrapper = rowOverlayZone;

        }

        public positionOverlayRowZone() {
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
            // (<HTMLElement>event.target).style.display = 'none';
            if (event.clientX) {
                coordinates = {
                    pointerX: event.clientX,
                    pointerY: event.clientY
                }
            }
            var underEl = document.elementFromPoint(event.clientX, event.clientY);
            // console.dir(event);
            if (underEl) _.simulateEvent((<HTMLElement>underEl), event.type, coordinates);
            (<HTMLElement>event.target).style.display = '';
        }

        private rowOverlayLeaveListener(event: any): boolean {
            // stop processing overlay when move out of zone
            // this.eOverlayRowWrapper.style.display = 'none';
            this.eventService.dispatchEvent(Events.EVENT_ALL_ROWS_STOP_LISTEN_MOUSE_MOVE);
            return;
        }

        private rowOverlayEnterListener(event: any): boolean {
            // (<HTMLElement>event.target).style.display = 'none';
            var underEl = document.elementFromPoint(event.clientX, event.clientY);
            var emptySpaceUnder = underEl.classList.contains('ag-body-viewport');
            (<HTMLElement>event.target).style.display = '';
            if (emptySpaceUnder) {
                console.log('empty');
                return;
            }
            // start processing overlay when move into zone
            // this.eOverlayRowWrapper.style.display = 'none';
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
            // return 0;
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
                
                // if (scrollWidth) {
                //     lastHeaderEl.style.width = (this.headerEl.offsetWidth - lastHeaderEl.offsetLeft) + 'px';
                //     console.log(lastHeaderEl.style.width);

                // }
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

        private createOverlayRowTemplate(actions: any[], availableHeightForMenu: number): string {
            let tmpl: string[] | string = [''];

            if (!actions) {
                var ii = 1;
                var margin = "";
                actions = this.gridOptionsWrapper.getActionTemplate();
                for (var k in actions) {
                    if (Object.keys(actions).length != ii)
                        margin = "m-r-sm";
                    else
                        margin = ""
                    var v = actions[k];
                    (<string[]>tmpl).push(`<a class="${margin}" title="${v}" href="#"><span id="ag-action-row-${k}" class="i-${k}" style="pointer-events:all;"></span></a>`);
                    ii++;
                }
                // tmpl = `
                //     <a title="Редактировать" href="#"><span id="ag-action-row-edit" class="i-edit" style="pointer-events:all;"></span></a>
                //     <a title="Удалить" href="#"><span id="ag-action-row-delete" class="i-delete" style="pointer-events:all;"></span></a>
                //     <a title="Разделить" href="#"><span id="ag-action-row-split" class="i-split" style="pointer-events:all;"></span></a>
                // `;

            } else {

                let menuTemplateStart = (data) => {
                    var attr = data.attribute;
                    var className = "";
                    var style = "pointer-events: all;";
                    if (attr && attr.disabled) {
                        className = "disabled";
                        style = "pointer-events:none;";
                    }
                    return `
                        <div
                            class="k-visible pi-dropdown-options pi-dropdown-options_hover btn-group k-action-elem_more m-r-sm ${data.auxClass}"
                            style="margin-left: -10px; pointer-events: all;"
                            title="${data.title}"
                        >
                            <span
                                class="b-options-btn b-options-btn_icon dropdown-toggle"
                                data-toggle="dropdown"
                                data-hover="dropdown"
                                aria-expanded="false"
                                style="${style}"
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

                    var attr = data.attribute;
                    var className = "";
                    var style = "";
                    if (attr && attr.disabled) {
                        className = "disabled";
                        style = "pointer-events:none;"
                    }
                    return `
                        <li title="${data.label}"">
                            <a style = "${style}" class="k-visible k-action-elem ${className} js-${data.code || 'dummy'}" data-status-id="${data.itemId}" href="\\#">
                                ${data.itemTitle}
                            </a>
                        </li>
                    `;
                }
                var menuTemplateItemLink = (data) => {
                    var attr = data.attribute;
                    var className = "";
                    var style = "";
                    if (attr && attr.disabled) {
                        className = "disabled";
                        style = "pointer-events:none;"

                    }
                    return `
                        <li title="${data.label}"">
                            <a style = "${style}" class="link-icon link-${data.itemCode} ${className} k-visible k-action-elem js-${data.itemCode}" href="${data.itemLink}">
                                <span class="content-center">
                                    ${data.itemTitle}
                                </span>
                            </a>
                        </li>
                    `;
                }
                var singleTemplate = (data, margin) => {
                    var styleIcon = "pointer-events:all;"
                    var attr = data.attribute;
                    var className;
                    if (attr && attr.disabled) {
                        className = "disabled"
                        styleIcon = "";
                        var styleA = "pointer-events:all; cursor: default"

                    }
                    return `
                    <a
                        class="${margin}"
                        title="${data.title}"
                        href= "\\#"
                        style="${styleA}"
                        data-jump=${data.jumpCode}
                        data-id="${data.jumpId}"
                        data-variant=${data.jumpVariant}
                        data-bread_crumb-link="#?page=${data.jumpCode}"
                        data-bread_crumb-text="${data.curPageTitle}"
                        data-bread_crumb-hint="${data.curPageHint}"
                    >
                        <span
                          class="pi-icon i-${data.code}  ${className} js-${data.code}"
                          style="${styleIcon}"
                          data-jump=${data.jumpCode}
                          data-id="${data.jumpId}"
                          data-variant=${data.jumpVariant}
                          data-bread_crumb-link="#?page=${data.jumpCode}"
                          data-bread_crumb-text="${data.curPageTitle}"
                          data-bread_crumb-hint="${data.curPageHint}"
                        ></span></a>
                    `;
                }
                var k = 1;
                var margin;
                for (let actionItem of actions) {

                    let data: any = {
                        title: actionItem.title,
                        code: actionItem.code,
                        jumpCode: actionItem.jumpCode,
                        jumpVariant: actionItem.jumpVariant,
                        jumpId: actionItem.jumpId,
                        curPageTitle: actionItem.curPageTitle,
                        curPageHint: actionItem.curPageHint,
                        attribute: actionItem.attribute
                    }

                    if ('children' in actionItem) {

                        let menuHeight = actionItem.children.length * 30 + 10;
                        data.auxClass = menuHeight > availableHeightForMenu ? 'dropup' : '';
                        (<string[]>tmpl).push(menuTemplateStart(data));

                        for (let menuItem of actionItem.children) {
                            let content: string;
                            data.itemId = menuItem.id;
                            data.itemTitle = menuItem.title;
                            data.label = menuItem.label || "";
                            data.attribute = menuItem.attribute
                            data.itemLink = menuItem.link;
                            data.itemCode = menuItem.code;

                            if (data.itemLink) {
                                content = menuTemplateItemLink(data);
                            } else if (data.itemId) {
                                content = menuTemplateItem(data);
                            } else {
                                content = "<div>Здесь могла бы быть..., да что угодно!</div>";
                            }
                            (<string[]>tmpl).push(content);
                        }

                        (<string[]>tmpl).push(menuTemplateEnd(data));

                    } else {
                        if (k != actions.length)
                            margin = "m-r-sm";
                        else
                            margin = "";

                        (<string[]>tmpl).push(singleTemplate(data, margin));

                    }
                    k++;

                }


            }

            tmpl = (<string[]>tmpl).join('');
            return this.getOverlayRowWrapper(<string>tmpl);
        }

        public showOverlayRow(rowData?: any) {
            if (this.eOverlayRowZoneWrapper === void 0) return;
            var actions: any = this.gridOptionsWrapper.getActionTemplate();
            var actionData: any;
            var actionClickSelector: string;

            var overlayBottom = parseInt(this.eOverlayRowZoneWrapper.style.height);
            var rowBottom = parseInt(this.eOverlayRowWrapper.style.top) + parseInt(this.eOverlayRowWrapper.style.height);
            var availableHeightForMenu = overlayBottom - rowBottom;


            if (rowData && typeof actions == 'function') {

                actionData = actions({
                    data: rowData,
                    type: 'actionTemplate'
                });
                if (!actionData.actions.length) {
                    this.eOverlayRowWrapper.style.display = 'none';
                    return;
                }
                while (this.eOverlayRowWrapper.firstChild) {
                    this.eOverlayRowWrapper.removeChild(this.eOverlayRowWrapper.firstChild);
                }

                let tempDiv = document.createElement("div");
                tempDiv.innerHTML = this.createOverlayRowTemplate(
                    actionData.actions,
                    availableHeightForMenu
                );


                this.eOverlayRowWrapper.appendChild(
                    tempDiv.firstElementChild
                );

                actionData.postActionFn();
                actionClickSelector = '.js-'

                actions = actionData.actions.reduce(
                    (acc, el) => {
                        if (el.children) {
                            for (let child of el.children) {
                                if (child.code) acc[child.code] = child.title;
                            }
                        }
                        acc[el.code] = el.title;
                        return acc;
                    },
                    {}
                )

            } else {

                if (!this.isActionsRedrawn) {
                    return;
                }
                this.isActionsRedrawn = false;

                document.querySelector('.ag-body-viewport').appendChild(this.eOverlayRowZoneWrapper);

                this.eOverlayRowWrapper.appendChild(
                    _.loadTemplate(this.createOverlayRowTemplate().trim())
                );

                let tempDiv = document.createElement("div");
                tempDiv.className = 'ag-overlay-drag'
                // this.eOverlayRowWrapper.appendChild(tempDiv);

                actionClickSelector = '#ag-action-row-'
                
            }


            for (var k in actions) {
                var v = actions[k];
                var that = this;

                (function(k) {
                    var actionElements = that.eOverlayRowWrapper.querySelectorAll(`${actionClickSelector}${k}`);

                    for (let actionElement of actionElements) {
                        actionElement.addEventListener('click', (event) => {
                            event.stopPropagation();
                            event.preventDefault();
                            that.rowActionListener(event, k);
                            return false;
                        });
                    }
                })(k);
            }

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

