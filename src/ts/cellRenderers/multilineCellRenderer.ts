/// <reference path="../utils.ts" />

module ag.grid {

    var _ = Utils;

    export function multilineCellRendererFactory(gridOptionsWrapper: GridOptionsWrapper) {

        return function multilineCellRenderer(params: any) {
            // wrap text content into multiple lines

            if (params.node.group) return params.value;

            var font = gridOptionsWrapper.getFont();
            var out = "";
            var width = params.column.actualWidth - gridOptionsWrapper.getWidthGap();
            var shiftWidth = gridOptionsWrapper.getGroupShiftWidth();
            var controlWidth = gridOptionsWrapper.getGroupControlWidth();

            // debugger;
            return params.value;

            // consider group shifter width in cell one
            if (shiftWidth && params.node && params.node.level) {
                width -= (shiftWidth * params.node.level)
            }
            if (params.column.index === 0 && controlWidth) {
                width -= controlWidth
            }
            if (width < 10) {
                width = 9
            }

            var templateEl = $('<div>').html(params.value);
            var contentTextEl = templateEl.find('.js-ag-text-wrap');
            var contentText = contentTextEl.text();
            if (!contentText) {
                return params.value;
            }
            
            var lines = _.getWidthHeight(contentText, width, font, gridOptionsWrapper.getMaxRows());
            var outputLines = lines.outputLines;

            params.rowsNeeded = lines.numLines;

            for (var i = 0; i < outputLines.length - 1; i++) {
                out += '<div>' + outputLines[i] + '</div>\n';
            }

            out += '<div style="overflow: hidden; text-overflow: ellipsis; width: ' + width + 'px;">' + outputLines[outputLines.length - 1] + '</div>'

            if (params.column.index === 0 && width > 48) {
                var shifter = getShifter(params.node.level || 0, true);
                out = '<div class="pi-table-cell_top pi-table-cell_fluid">' + out + '</div>'
                out = '<div class="pi-table">' + shifter + out + '</div>'
            }

            contentTextEl.html(out);
            // return params.value;
            return contentTextEl.prop('outerHTML');
        }

        function getShifter(steps: number, needControlWidth: boolean = false) {

            var controlWidth = gridOptionsWrapper.getGroupControlWidth();
            var shifter: string[] = [];
            var i = 0;
            if (needControlWidth) {
                i = 1;
            }

            while (i < steps) {
                shifter.push("<span class='group-expand-shifter'></span>");
                i++;
            }

            // add extra shift considering group expand control width
            if (needControlWidth && controlWidth) {
                shifter.push("<span class='group-expand-shifter group-expand-shifter-extra' style='width:" + controlWidth + "px;'></span>");
            }

            return '<div class="pi-table-cell_top pi-table-cell_fixed">' + shifter.join('') + '</div>';
        }
    }
}
