<?php
$pageTitle = "Angular Compiling";
$pageDescription = "Angular Grid Angular Compiling";
$pageKeyboards = "Angular Grid Angular Compiling";
include '../documentation_header.php';
?>

<div>

    <h2>Grid Options</h2>

    Each grid needs to be provided with a set of grid options. All the possible
    parameters for the grid options are listed below with a brief description.
    Full details of the options can be found in the relevant sections.

    <p/>
    <p/>

    <table class="table">
        <tr>
            <th>Attribute</th>
            <th>Description</th>
        </tr>
        <tr>
            <th>columnDefs</th>
            <td>Array of Column Definitions..</td>
        </tr>
        <tr>
            <th>groupHeaders</th>
            <td>Whether to group the headers. Default is false.</td>
        </tr>
        <tr>
            <th>headerHeight</th>
            <td>Height, in pixels, of the header row. If not grouping headers, default is 25. If grouping headers, default is 50.</td>
        </tr>
        <tr>
            <th>rowData</th>
            <td>Data to be displayed as rows in the table</td>
        </tr>
        <tr>
            <th>rowSelection</th>
            <td>Type of row selection, set to either 'single' or 'multiple' to enable selection.</td>
        </tr>
        <tr>
            <th>pinnedColumnCount</th>
            <td>Number of columns to pin. Default is 0.</td>
        </tr>
        <tr>
            <th>rowHeight</th>
            <td>Height of rows, in pixels. Default is 25 pixels.</td>
        </tr>
        <tr>
            <th>enableColResize</th>
            <td>Set to true or false (default is false)</td>
        </tr>
        <tr>
            <th>enableSorting</th>
            <td>Set to true or false (default is false)</td>
        </tr>
        <tr>
            <th>enableFilter</th>
            <td>Set to true or false (default is false)</td>
        </tr>
        <tr>
            <th>quickFilterText</th>
            <td>Rows are filtered using this text as a 'quick filter'</td>
        </tr>
        <tr>
            <th>rowClass</th>
            <td>Class to use for the row. Can be string, array of strings, or function.</td>
        </tr>
        <tr>
            <th>rowStyle</th>
            <td>An object of CSS values. Or a function returning an object of css values.</td>
        </tr>
        <tr>
            <th>angularCompileRows</th>
            <td>Whether to compile the rows for Angular. Default is false (for performance).
                Turn on if you want to use AngularJS in your custom cell renderers.</td>
        </tr>
        <tr>
            <th>angularCompileFilters</th>
            <td>Whether to compile provided custom filters. Default is false (for performance).
                Turn on if you want to use AngularJS in your custom filters.</td>
        </tr>
        <tr>
            <th>angularCompileHeaders</th>
            <td>Whether to compile the customer headers for AngularJS. Default is false (for performance).
                Turn on if you want to user AngularJS in your custom column headers.</td>
        </tr>
        <tr>
            <th>headerCellRenderer</th>
            <td>Provide a function for custom header rendering.</td>
        </tr>
        <tr>
            <th>groupKeys<br/> groupUseEntireRow<br/> groupInnerCellRenderer<br/> groupDefaultExpanded<br/> groupAggFunction</th>
            <td>Parameters for grouping. See the section on grouping for details explanation.</td>
        </tr>
        <tr>
            <th>dontUseScrolls</th>
            <td>Set to true or false (default is false). When true, scrollbars are not used.</td>
        </tr>
        <tr>
            <th>rowSelected</th>
            <td>Function callback, gets called when a row is selected.</td>
        </tr>
        <tr>
            <th>rowClicked</th>
            <td>Function callback, gets called when a row is clicked.</td>
        </tr>
        <tr>
            <th>cellClicked</th>
            <td>Function callback, gets called when a cell is clicked.</td>
        </tr>
        <tr>
            <th>selectionChanged</th>
            <td>Function callback, gets called when a selection is changed.</td>
        </tr>
    </table>

</div>

<?php include '../documentation_footer.php';?>