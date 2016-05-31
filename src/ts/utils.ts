
module ag.grid {

    var FUNCTION_STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    var FUNCTION_ARGUMENT_NAMES = /([^\s,]+)/g;

    export class Utils {

        // taken from:
        // http://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser
        private static isSafari = Object.prototype.toString.call((<any>window).HTMLElement).indexOf('Constructor') > 0;
        private static isIE = /*@cc_on!@*/false || !!(<any>document).documentMode; // At least IE6
        private static canvas: any;

        static getTextWidth(text: string, font: string): number {
            // get text visual width for the whole line
            var context: any;
            var metrics: any;
            if (!this.canvas) {
                this.canvas = document.createElement("canvas");
            }
            context = this.canvas.getContext("2d");
            context.font = font;
            metrics = context.measureText(text);
            return parseInt(metrics.width);
        }


        static getWidthHeight(value: string, allowedWidth: number, font: string, maxLines:number): any {
            // separate text into lines for content autoWrap
            // according to given width in px and font metrics

            if (!value) {
                value = ''
            } else {
                value = value.toString()
            }
            var words = value.split(" ");
            var lineWidth = 0;
            var charCounter = 0;
            var startCounter = 0;
            var maxWidth = 0;
            var divText = "";
            var numLines = 1;
            var outputLines:string[] = [];
            var lineOut = '';
            var curRow = '';
            var spaceWidth = this.getTextWidth(' ', font);

            for (var i = 0; i < words.length; i++) {
                var text = words[i];
                var thisWidth = this.getTextWidth(text, font);

                if (lineWidth + thisWidth > allowedWidth) {
                    // end this line, begin a new one.
                    if (lineWidth > maxWidth) maxWidth = lineWidth;
                    var lineOut = value.substr(startCounter, charCounter);

                    if (lineOut.length) {
                        i--; // go back one word since this word needs to start on a new line
                        lineWidth = thisWidth;
                        startCounter += charCounter;
                    
                        outputLines.push(lineOut);
                    }

                    curRow = value.substr(startCounter - charCounter);
                    if (outputLines.length === maxLines && curRow.length) {
                        outputLines.pop();
                        outputLines.push(curRow);
                        break;
                    }
                    charCounter = 0;
                } else {
                    lineWidth += thisWidth + spaceWidth;
                    charCounter += text.length + 1;
                    curRow = value.substr(startCounter);
                    if (i === (words.length - 1) && curRow.length)  {
                        outputLines.push(curRow);
                    }
                }
            }
            if (maxWidth === 0) maxWidth = allowedWidth;
            if (outputLines.length === 0) outputLines.push(value);

            return {
                outputLines: outputLines,
                numLines: outputLines.length,
                maxWidth: maxWidth
            };

        }

        static reflowText(elText: HTMLElement, allText: string) {
            // debugger
            var words = allText.split(' ');
            var overflown = false;
            if (!elText) {
                return;
            }
            var tail = '…';
            var text: string;
            var lastWord: string[];
            var lastPart = '';
            var ltterToAdd;

            let isOverflown = (elText) => Math.abs(elText.scrollHeight - elText.clientHeight) > 2

            var cutPoint = words.length;
            while (isOverflown(elText)) {
                text = words.slice(0, cutPoint--).join(' ')
                elText.innerHTML = text + tail;
            }
            lastWord = (' ' + (words[cutPoint+1] || '')).split('')
            if (lastWord && lastWord.length > 1) {
                // if (lastPart.length > 2) {
                //     debugger;
                // }
                while (!isOverflown(elText) && lastWord.length) {
                    elText.innerHTML = text + lastPart + tail;
                    ltterToAdd = lastWord.shift();
                    lastPart += ltterToAdd;
                }
                elText.innerHTML = text + lastPart.slice(0, -2) + tail;
                // elText.innerHTML = words.slice(0, cutPoint).join(' ') + tail;
            //     // var lastWord = words[cutPoint + 2] || words[cutPoint + 1]
            //     var lastWord = words[cutPoint + 1];
            //     cutPoint = 0;

            //     while (lastWord && cutPoint < lastWord.length && Math.abs(elText.scrollHeight - elText.clientHeight) <= 2) {
            //         console.log(lastWord, cutPoint);
            //         elText.innerHTML = text + ' ' + lastWord.slice(0, cutPoint++) + tail;
            //     }
            //     if (cutPoint < 2) {
            //         elText.innerHTML = text + tail;
            //     } else {
            //         elText.innerHTML = text + ' ' + lastWord.slice(0, cutPoint - 2) + tail;
            //     }
            }


            // elText.innerHTML = words[0];

            // // find the word that breaks last allowed line
            // for (var i = 1; i < words.length; i++) {
            //     elText.innerHTML = elText.innerHTML + ' ' + words[i];
            //     // if (this.column.colId === 'agreementNumber') {
            //     //     debugger;
            //     // }
            //     if (Math.abs(elText.scrollHeight - elText.clientHeight) > 2) {
            //         overflown = true;
            //         break;
            //         // console.log(`broke on ${i} word`);
            //     }
            // }

            // // bite out by one char until overflown is gone adding ellipsis to the tail
            // if (overflown) {
            //     // debugger;
            //     var displayText = elText.innerHTML + v;
            //     // console.log(displayText);

            //     do {

            //         do {
            //             displayText = displayText.slice(0, -2) + '…';
            //         } while (displayText.slice(-2, -1) === ' '); //get rid of tail spaces

            //         elText.innerHTML = displayText;
            //         // console.log(displayText);

            //     } while (
            //         displayText.length > 1
            //         &&
            //         Math.abs(elText.scrollHeight - elText.clientHeight) > 2
            //     );
            // } else {
            //     // console.log('not overflown');
            // }

        }


        static iterateObject(object: any, callback: (key:string, value: any) => void) {
            var keys = Object.keys(object);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var value = object[key];
                callback(key, value);
            }
        }

        static cloneObject(object: any): any {
            var copy = <any>{};
            var keys = Object.keys(object);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var value = object[key];
                copy[key] = value;
            }
            return copy;
        }

        static map<TItem, TResult>(array: TItem[], callback: (item: TItem) => TResult) {
            var result: TResult[] = [];
            for (var i = 0; i < array.length; i++) {
                var item = array[i];
                var mappedItem = callback(item);
                result.push(mappedItem);
            }
            return result;
        }

        static forEach<T>(array: T[], callback: (item: T, index: number) => void) {
            if (!array) {
                return;
            }

            for (var i = 0; i < array.length; i++) {
                var value = array[i];
                callback(value, i);
            }
        }

        static filter<T>(array: T[], callback: (item: T) => boolean): T[] {
            var result: T[] = [];
            array.forEach(function(item: T) {
                if (callback(item)) {
                    result.push(item);
                }
            });
            return result;
        }

        static assign(object: any, source: any): void {
            Utils.iterateObject(source, function(key: string, value: any) {
                object[key] = value;
            });
        }

        static getFunctionParameters(func: any) {
            var fnStr = func.toString().replace(FUNCTION_STRIP_COMMENTS, '');
            var result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(FUNCTION_ARGUMENT_NAMES);
            if (result === null) {
                return [];
            } else {
                return result;
            }
        }

        static find(collection: any, predicate: any, value: any) {
            if (collection === null || collection === undefined) {
                return null;
            }
            for (var i = 0; i < collection.length; i++) {
                if (collection[i][predicate] === value) {
                    return collection[i];
                }
            }
            return null;
        }

        static toStrings<T>(array: T[]): string[] {
            return this.map(array, function (item) {
                if (item === undefined || item === null || !item.toString) {
                    return null;
                } else {
                    return item.toString();
                }
            });
        }

        static iterateArray<T>(array: T[], callback: (item: T, index: number) => void) {
            for (var index = 0; index < array.length; index++) {
                var value = array[index];
                callback(value, index);
            }
        }

        //Returns true if it is a DOM node
        //taken from: http://stackoverflow.com/questions/384286/javascript-isdom-how-do-you-check-if-a-javascript-object-is-a-dom-object
        static isNode(o: any) {
            return (
                typeof Node === "object" ? o instanceof Node :
                o && typeof o === "object" && typeof o.nodeType === "number" && typeof o.nodeName === "string"
            );
        }

        //Returns true if it is a DOM element
        //taken from: http://stackoverflow.com/questions/384286/javascript-isdom-how-do-you-check-if-a-javascript-object-is-a-dom-object
        static isElement(o: any) {
            return (
                typeof HTMLElement === "object" ? o instanceof HTMLElement : //DOM2
                o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName === "string"
            );
        }

        static isNodeOrElement(o: any) {
            return this.isNode(o) || this.isElement(o);
        }

        //adds all type of change listeners to an element, intended to be a text field
        static addChangeListener(element: HTMLElement, listener: EventListener) {
            element.addEventListener("changed", listener);
            element.addEventListener("paste", listener);
            element.addEventListener("input", listener);
            // IE doesn't fire changed for special keys (eg delete, backspace), so need to
            // listen for this further ones
            element.addEventListener("keydown", listener);
            element.addEventListener("keyup", listener);
        }

        // new event object from existing
        static simulateEvent(element: HTMLElement, eventName: string, coordinates?: any): HTMLElement {
            console.log(eventName);

            function extend(destination: any, source: any): any {
                for (var property in source)
                    destination[property] = source[property];
                return destination;
            }

            var eventMatchers:any = {
                'HTMLEvents': /^(?:load|unload|abort|error|select|change|submit|reset|focus|blur|resize|scroll|wheel|DOMMouseScroll|MSPointerMove|pointermove)$/,
                'MouseEvents': /^(?:click|dblclick|mouse(?:down|up|over|move|out|enter|leave|wheel))$/
            }

            var defaultOptions = {
                pointerX: 0,
                pointerY: 0,
                button: 0,
                ctrlKey: false,
                altKey: false,
                shiftKey: false,
                metaKey: false,
                bubbles: true,
                cancelable: true
            }

            var options = extend(defaultOptions, coordinates || {});
            var oEvent: Event;
            var eventType: string = null;

            for (var name in eventMatchers) {
                if (eventMatchers[name].test(eventName)) { eventType = name; break; }
            }

            if (!eventType)
                throw new SyntaxError('Only HTMLEvents and MouseEvents interfaces are supported');

            if (typeof MouseEvent !== 'function') {
                (function() {
                    var _MouseEvent = window.MouseEvent;
                    window.MouseEvent = function(type, dict) {
                        dict = dict | {};
                        var event = document.createEvent('MouseEvents');
                        event.initMouseEvent(
                            type,
                            (typeof dict.bubbles == 'undefined') ? true : !!dict.bubbles,
                            (typeof dict.cancelable == 'undefined') ? false : !!dict.cancelable,
                            dict.view || window,
                            dict.detail | 0,
                            dict.screenX | 0,
                            dict.screenY | 0,
                            dict.clientX | 0,
                            dict.clientY | 0,
                            !!dict.ctrlKey,
                            !!dict.altKey,
                            !!dict.shiftKey,
                            !!dict.metaKey,
                            dict.button | 0,
                            dict.relatedTarget || null
                        );
                        return event;
                    }
                })();
            }

            if (document.createEvent) {
                oEvent = document.createEvent(eventType);
                if (eventType == 'HTMLEvents') {
                    oEvent = new Event(
                        eventName,
                        options
                    );
                }
                else {
                    oEvent = new MouseEvent(
                        eventName,
                        options
                    );
                }
                console.log(oEvent);
                element.dispatchEvent(oEvent);
            }
            else {
                options.clientX = options.pointerX;
                options.clientY = options.pointerY;
                var evt: Event = new Event(eventName);
                oEvent = extend(evt, options);
                element.dispatchEvent(oEvent);
            }
            return element;
        }



        //if value is undefined, null or blank, returns null, otherwise returns the value
        static makeNull(value: any) {
            if (value === null || value === undefined || value === "") {
                return null;
            } else {
                return value;
            }
        }

        static removeAllChildren(node: HTMLElement) {
            if (node) {
                while (node.hasChildNodes()) {
                    node.removeChild(node.lastChild);
                }
            }
        }

        static removeElement(parent: HTMLElement, cssSelector: string) {
            this.removeFromParent(parent.querySelector(cssSelector));
        }

        static removeFromParent(node: Element) {
            if (node && node.parentNode) {
                node.parentNode.removeChild(node);
            }
        }

        static isVisible(element: HTMLElement) {
            return (element.offsetParent !== null)
        }

        /** 
         * loads the template and returns it as an element. makes up for no simple way in
         * the dom api to load html directly, eg we cannot do this: document.createElement(template) 
         */
        static loadTemplate(template: string) {
            var tempDiv = document.createElement("div");
            tempDiv.innerHTML = template;
            return tempDiv.firstChild;
        }

        static querySelectorAll_addCssClass(eParent: any, selector: string, cssClass: string) {
            var eRows = eParent.querySelectorAll(selector);
            for (var k = 0; k < eRows.length; k++) {
                this.addCssClass(eRows[k], cssClass);
            }
        }

        static querySelectorAll_removeCssClass(eParent: any, selector: string, cssClass: string) {
            var eRows = eParent.querySelectorAll(selector);
            for (var k = 0; k < eRows.length; k++) {
                this.removeCssClass(eRows[k], cssClass);
            }
        }

        static querySelectorAll_replaceCssClass(eParent: any, selector: string, cssClassToRemove: string, cssClassToAdd: string) {
            var eRows = eParent.querySelectorAll(selector);
            for (var k = 0; k < eRows.length; k++) {
                this.removeCssClass(eRows[k], cssClassToRemove);
                this.addCssClass(eRows[k], cssClassToAdd);
            }
        }

        static addOrRemoveCssClass(element: HTMLElement, className: string, addOrRemove: boolean) {
            if (addOrRemove) {
                this.addCssClass(element, className);
            } else {
                this.removeCssClass(element, className);
            }
        }

        static addCssClass(element: HTMLElement, className: string) {
            if (element.className && element.className.length > 0) {
                var cssClasses = element.className.split(' ');
                if (cssClasses.indexOf(className) < 0) {
                    cssClasses.push(className);
                    element.className = cssClasses.join(' ');
                }
            } else {
                element.className = className;
            }
        }

        static findParentWithClass(element: HTMLElement, classname: string):HTMLElement {
            if (element.className.split(' ').indexOf(classname) >= 0) return element;
            return element.parentNode && this.findParentWithClass(<HTMLElement>element.parentNode, classname);
        }        

        static offsetHeight(element: HTMLElement) {
            return element && element.clientHeight ? element.clientHeight : 0;
        }

        static offsetWidth(element: HTMLElement) {
            return element && element.clientWidth ? element.clientWidth : 0;
        }

        static removeCssClass(element: HTMLElement, className: string) {
            if (element.className && element.className.length > 0) {
                var cssClasses = element.className.split(' ');
                var index = cssClasses.indexOf(className);
                if (index >= 0) {
                    cssClasses.splice(index, 1);
                    element.className = cssClasses.join(' ');
                }
            }
        }

        static removeFromArray<T>(array: T[], object: T) {
            if (array.indexOf(object) >= 0) {
                array.splice(array.indexOf(object), 1);
            }
            
        }

        static defaultComparator(valueA: any, valueB: any) {
            var valueAMissing = valueA === null || valueA === undefined;
            var valueBMissing = valueB === null || valueB === undefined;
            if (valueAMissing && valueBMissing) {
                return 0;
            }
            if (valueAMissing) {
                return -1;
            }
            if (valueBMissing) {
                return 1;
            }

            if (valueA < valueB) {
                return -1;
            } else if (valueA > valueB) {
                return 1;
            } else {
                return 0;
            }
        }

        static formatWidth(width: number | string) {
            if (typeof width === "number") {
                return width + "px";
            } else {
                return width;
            }
        }

        /** 
         * Tries to use the provided renderer.
         */
        static useRenderer<TParams>(eParent: Element, eRenderer: (params:TParams) => Node | string, params: TParams) {
            var resultFromRenderer = eRenderer(params);
            //TypeScript type inference magic
            if (typeof resultFromRenderer === 'string') {
                var eTextSpan = document.createElement('span');
                eTextSpan.innerHTML = resultFromRenderer;
                eParent.appendChild(eTextSpan);
            } else if (this.isNodeOrElement(resultFromRenderer)) {
                //a dom node or element was returned, so add child
                eParent.appendChild(<Node>resultFromRenderer);
            }
        }

        /** 
         * If icon provided, use this (either a string, or a function callback).
         * if not, then use the second parameter, which is the svgFactory function
         */
        static createIcon(iconName: any, gridOptionsWrapper: any, colDefWrapper: any, svgFactoryFunc: () => Node) {
            var eResult = document.createElement('span');
            var userProvidedIcon: Function | string;
            // check col for icon first
            if (colDefWrapper && colDefWrapper.colDef.icons) {
                userProvidedIcon = colDefWrapper.colDef.icons[iconName];
            }
            // it not in col, try grid options
            if (!userProvidedIcon && gridOptionsWrapper.getIcons()) {
                userProvidedIcon = gridOptionsWrapper.getIcons()[iconName];
            }
            // now if user provided, use it
            if (userProvidedIcon) {
                var rendererResult: any;
                if (typeof userProvidedIcon === 'function') {
                    rendererResult = userProvidedIcon();
                } else if (typeof userProvidedIcon === 'string') {
                    rendererResult = userProvidedIcon;
                } else {
                    throw 'icon from grid options needs to be a string or a function';
                }
                if (typeof rendererResult === 'string') {
                    eResult.innerHTML = rendererResult;
                } else if (this.isNodeOrElement(rendererResult)) {
                    eResult.appendChild(rendererResult);
                } else {
                    throw 'iconRenderer should return back a string or a dom object';
                }
            } else {
                // otherwise we use the built in icon
                eResult.appendChild(svgFactoryFunc());
            }
            return eResult;
        }

        static addStylesToElement(eElement: any, styles: any) {
            Object.keys(styles).forEach(function (key) {
                eElement.style[key] = styles[key];
            });
        }

        static getScrollbarWidth() {
            var outer = document.createElement("div");
            outer.style.visibility = "hidden";
            outer.style.width = "100px";
            outer.style.msOverflowStyle = "scrollbar"; // needed for WinJS apps

            document.body.appendChild(outer);

            var widthNoScroll = outer.offsetWidth;
            // force scrollbars
            outer.style.overflow = "scroll";

            // add innerdiv
            var inner = document.createElement("div");
            inner.style.width = "100%";
            outer.appendChild(inner);

            var widthWithScroll = inner.offsetWidth;

            // remove divs
            outer.parentNode.removeChild(outer);

            return widthNoScroll - widthWithScroll;
        }

        static isKeyPressed(event: KeyboardEvent, keyToCheck: number) {
            var pressedKey = event.which || event.keyCode;
            return pressedKey === keyToCheck;
        }

        static setVisible(element: HTMLElement, visible: boolean) {
            if (visible) {
                element.style.display = 'inline';
            } else {
                element.style.display = 'none';
            }
        }

        static isBrowserIE(): boolean {
            return this.isIE;
        }

        static isBrowserSafari(): boolean {
            return this.isSafari;
        }

    }
}

