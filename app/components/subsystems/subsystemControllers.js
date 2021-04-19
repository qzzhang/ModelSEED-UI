
angular.module('Subsystems', ['uiTools'])
// Begin MySubsystems controller
.controller('MySubsystems',
['$scope', 'WS', 'MS', 'Auth', 'Session', 'uiTools', 'Dialogs', '$state',
function($s, WS, MS, Auth, Session, uiTools, Dialogs, $state) {

    $s.tabs = {tabIndex: Session.getTab($state)};
    $s.$watch('tabs', function(value) { Session.setTab($state, value) }, true)

    $s.mySubsysOpts = {query: '', limit: 20, offset: 0, sort: {field: 'subsysName', desc: true}};

    $s.mySubsysHeader = [
        {label: 'Subsystem name', key: 'subsysName',
          link: {
            state: 'app.subsystem',
            getOpts: function(row) {
                if (!row.isFolder)
                    return {path: row.path};
                else
                    return {path: ''};
            }
          }
        },
        {label: 'Modification Date', key: 'timestamp',
            formatter: function(row) {
                return uiTools.relativeTime(row.timestamp);
            }
        }
    ];

    $s.loadingMySubsystems = true;

    MS.listMySubsystems('/'+Auth.user+'/subsystems')
      .then(function(subsys) {
          $s.mySubsystems = subsys;
          $s.loadingMySubsystems = false;
      }).catch(function(e) {
          $s.loadingMySubsystems = false;
          $s.mySubsystems = [];
      })

    // copy subsystem to my subsystem
    $s.submit = function(items, cb) {
        copySubsystem(items).then(cb)
    }

    // delete a subsystem
    $s.deleteSubsystem = function(items, cb) {
        alert("The deletion feature is to be implemented...");
        /*
        var paths = [];
        items.forEach(function(item) {
            paths.push(item.path)
        })

        WS.deleteObj(paths)
          .then(cb)
          .then(function() {
                Dialogs.showComplete('Deleted '+paths.length+' subsystem'+
                                     (paths.length>1 ? 's' : ''))
          })
          */
    }

    // direct user to the new subsystem page
    $s.newSubsystem = function() {
        alert("The createNew feature is to be implemented...");
        // $state.go('app.subsystem', {path: '/'+Auth.user+'/subsystems/new-subsystem'})
    }

    function copySubsystem(items) {
        var paths = [];
        items.forEach(function(item) { paths.push(item.path); })

        var destination = '/'+Auth.user+'/subsystems';
        return WS.createFolder(destination)
            .then(function(res) {
                WS.copyList(paths, destination)
                  .then(function(res) {
                    $s.mySubsystem = mergeObjects($s.mySubsystem, WS.sanitizeSubsystemObjs(res), 'path');
                    Dialogs.showComplete('Copied '+res.length+' subsystem'+
                                            (paths.length>1 ? 's' : ''))
                    $s.tabs.tabIndex = 2; // 'My Subsystem'
                }).catch(function(e) {
                    if (e.error.code === -32603)
                        Dialogs.error("Oh no!", "Can't overwrite your existing subsystem names."+
                                      "Please consider renaming or deleting.")
                })
            })
    }

}])
// End MySubsystems controller

// Begin Subsystem controller
.controller('Subsystem',
['$scope', '$state', 'WS', 'MS','$stateParams', 'uiTools', 'Dialogs', '$http', 'Auth',
function($s, $state, WS, MS, $stateParams, tools, Dialogs, $http, Auth) {
    // $s.subsysOpts = {query: '', limit: 10, offset: 0, sort: {field: 'Genome'}};
    $s.subsysOpts = {query: '', offset: 0, sort: {field: 'Genome'}};
    $s.subsysHeader = []; // dynamically filled later
    $s.subsysData = [];
    $s.subsysDataClone = [];

    // workspace path and name of object
    var wsPath = $stateParams.path;
    if( wsPath == '' ) {
        console.log('Please specify the correct user name and path to the subsystem.');
        return false;
    }

    // Find the subsystem file path
    $s.subsysDir = wsPath.split('/').slice(0, 3).join('/');
    $s.subsysPath = wsPath;
    var subsysFileName = wsPath.split('/').pop();
    $s.captions = [];
    $s.topRows = [];
    $s.compartments = getCompartments();

    // loading the subsystem data (in json format)
    $s.loading = true;
    $s.listAllSubsysFamTrees = true;
    if (WS.cached.subsystem && WS.cached.subsysName===subsysFileName) {
        $s.subsysData = WS.cached.subsystem;
        $s.subsysDataClone = WS.cached.subsystemClone;
        $s.subsysHeader = WS.cached.subsysHeader;
        $s.subsysName = WS.cached.subsysName;
        $s.allSubsysFamTrees = WS.cached.allSubsysFamTrees;
        $s.captions = WS.cached.captions;
        $s.mySubsysFamTrees = WS.cached.mySubsysFamTrees;
        $s.loading = false;
        $s.listAllSubsysFamTrees = false;
    } else {
        WS.get(wsPath)
        .then(function(res) {
            var res_data = res.data.data;
            $s.subsysName = res_data.subsystem_name;
            $s.subsysMeta = res.meta;

            // unmasked data
            var subsysObjData = Object.assign({}, res_data.subsystem_data);
            $s.subsysDataClone = JSON.parse(JSON.stringify(subsysObjData));
            WS.cached.subsystemClone = $s.subsysDataClone;

            // html-masked data
            parseSubsysData(res_data.subsystem_data);
            $s.subsysData = buildHtmlContent($s.subsysData);
            WS.cached.captions = $s.captions;
            WS.cached.mySubsysFamTrees = $s.mySubsysFamTrees;
            WS.cached.subsystem = $s.subsysData;
            WS.cached.subsysName = $s.subsysName;

            // subsystem table header
            $s.subsysHeader[0] = {label: $s.captions[0], key: $s.captions[0]};
            for (var k=1; k<$s.captions.length; k++) {
                $s.subsysHeader[k] = {label: $s.captions[k], key: $s.captions[k], column_id: k, formatter: function(row) {
                    return '<span>'+row+'</span>';
                }
            }}
            WS.cached.subsysHeader = $s.subsysHeader;

            // list all family trees under the subsystems/families folder
            MS.listAllSubsysFamilyTrees()
            .then(function(subsysTrees) {
                    $s.allSubsysFamTrees = subsysTrees;
                    WS.cached.allSubsysFamTrees = subsysTrees;
                }).catch(function(e) {
                    $s.allSubsysFamTrees = [];
                });
            $s.listAllSubsysFamTrees = false;
            $s.loading = false;
        })
        .catch(function(err) {
            console.log('Caught an error: "' + (err.error.message).replace(/_ERROR_/gi, '') + '"');
            $s.listAllSubsysFamTrees = false;
            $s.loading = false;
        });
    }

    $s.save = function(data) {
        var data_obj = {"data": {"subsystem_name": $s.subsysName, "subsystem_data": data}};
        return WS.save(wsPath, data_obj, {overwrite: true, userMeta: {}, type: 'unspecified'})
            .then(function() {
                $s.subsysDataClone = Object.assign({}, data);
                Dialogs.showComplete('Saving subsystems', $s.subsysName);
                $state.go('app.subsystem', wsPath);
            }).catch(function(e) {
                console.log('error', e)
                Dialogs.showError('Save error', e.error.message.slice(0,30)+'...')
            })
    }

    $s.saveAs = function(data, newName) {
        var folder = '/'+Auth.user+'/subsystems/';
        // Rename not only the subsystem file, but also the subsystem name to newName
        // (not $s.subsysName any more)
        var data_obj = {"data": {"subsystem_name": newName, "subsystem_data": data}};
        return WS.save(folder+newName, data_obj, {overwrite: true, userMeta: {}, type: 'unspecified'})
            .then(function(res) {
                Dialogs.showComplete('Saving subsystem data as ', newName);
                $state.go('app.subsystem', {path: folder+newName});
            }).catch(function(e) {
                console.log('error', e)
                Dialogs.showError('Save error', e.error.message.slice(0,30)+'...')
            })
    }

    $s.savePhyloXML = function(data) {
        return WS.save($s.phyloxml_wsPath, data, {overwrite: true, userMeta: {}, type: 'unspecified'})
            .then(function() {
                $s.xmlDataClone = Object.assign({}, data);
                Dialogs.showComplete('Saved phyloxml', $s.subsysName);
                // $state.go('app.subsystem', wsPath);
            }).catch(function(e) {
                console.log('error', e)
                Dialogs.showError('Save error', e.error.message.slice(0,30)+'...')
            })
    }

    function getCompartments() {
        return [
            'cytosol',
            'plastid',
            'mitochondria',
            'peroxisome'
        ].sort();
    }
    // Parse the given data for the subsystem data structure
    function parseSubsysData(obj_data) {
        // convert the subsystem data into
        // 1) an arraty with "Genome" as first (column) element and the rest are function roles--the "captions" array;
        // 2) an object of key-value pairs where 'key' is the function role and 'value' holds the protein families, the families object;
        // 3) an array of objects parsed from an array of arrays, where each object represents a row of data in the
        // subsystem table:
        // The first row of data is the respective families where each function role (column caption) is associated.
        // The second row of data is the respective reactions where each function role (column caption) is associated.
        // The third row of data is the respective cofactors where each function role (column caption) is associated.
        // The fourth row of data is the respective localizations where each function role (column caption) is associated.
        // The rows after the first four consist of gene annotation details in arrays of geneIds under the categories of
        // 'candidates'
        // 'caption' of the column serving as the key.
        //

        // fetching the subsystem head captions (Genome), Families, Reactions, CoFactors and Localizations
        var row_keys = ['Genome', 'Families', 'Reactions', 'Cofactors', 'Localizations'];
        var data = [];
        $s.topRows = [];
        for (var i0=0; i0<row_keys.length; i0++) {
            $s.topRows.push(obj_data[i0][row_keys[i0]]);
            $s.topRows[i0].unshift(row_keys[i0]);
        }
        var families = reduceArr($s.topRows[0], $s.topRows[1]);
        data[0] = families;
        data[1] = reduceArr($s.topRows[0], $s.topRows[2]); 
        data[2] = reduceArr($s.topRows[0], $s.topRows[3]);
        data[3] = reduceArr($s.topRows[0], $s.topRows[4]); 

        // fetching the annotation details, in rows
        for (var i=5; i<obj_data.length; i++) {
            row_keys.push(Object.keys(obj_data[i])[0]);
            var tmp_data = obj_data[i][row_keys[i]];  // a row of data
            tmp_data.unshift(row_keys[i]);
            data[i-1] = reduceArr($s.topRows[0], tmp_data);
        }

        $s.captions = $s.topRows[0];
        $s.subsysData = data;
        $s.mySubsysFamTrees = families;
        return true;
    }

    // combine two separate arrays into key value pairs by using array's reduce function
    function reduceArr(arr1, arr2) {
        return arr2.reduce(function(result, field, index) {
            result[arr1[index]] = field;
            // console.log(result);
            return result; 
        }, {});
    }

    // With the given data from the NEW subsystem data structure, build the html content for table cells
    function buildHtmlContent(input_data) {
        /*
        input_data: has a structure of an array of objects.  Examples of input_data rows:
        1st row:
            input_data[0] = {Genome: "Families"
                "UDP-4-dehydro-6-deoxy-glucose 3,5-epimerase (no EC)": ["OG0001720"],
                "UDP-4-dehydro-rhamnose reductase (EC 1.1.1.-)": ["OG0000342"],
                "UDP-glucose 4,6-dehydratase (EC 4.2.1.76)": [],...
            }
        2nd row:
            input_data[1]= {Genome: "Reactions"
                "UDP-4-dehydro-6-deoxy-glucose 3,5-epimerase (no EC)": "rxn02735",
                "UDP-4-dehydro-rhamnose reductase (EC 1.1.1.-)": "rxn02735",
                "UDP-glucose 4,6-dehydratase (EC 4.2.1.76)": "rxn00215"
            }
        3rd row:
            input_data[1]= {Genome: "Cofactors"
                "UDP-4-dehydro-6-deoxy-glucose 3,5-epimerase (no EC)": {"cpd00034:0":0,"cpd10515:0":0,"cpd10516:0":0},
                "UDP-4-dehydro-rhamnose reductase (EC 1.1.1.-)": {"cpd00034:0":0,"cpd10515:0":0,"cpd10516:0":0},
                "UDP-glucose 4,6-dehydratase (EC 4.2.1.76)": {...},...
            }
        4th row:
            input_data[1]= {Genome: "Localizations"
                "UDP-4-dehydro-6-deoxy-glucose 3,5-epimerase (no EC)": ["cytosol","mitochondria","cpd10516"],
                "UDP-4-dehydro-rhamnose reductase (EC 1.1.1.-)": ["cytosol","mitochondria","cpd10516"],,
                "UDP-glucose 4,6-dehydratase (EC 4.2.1.76)": [...],...
            }
        5th (and other) rows:
            input_data[1]= {Genome: "Athaliana"
                "UDP-4-dehydro-6-deoxy-glucose 3,5-epimerase (no EC)": [
                    {candidate: "AT4G14710.5", "prediction": 0,"curation": 1},
                    {candidate: "AT4G14716.1", "prediction": 0,"curation": 1},...]
                "UDP-4-dehydro-rhamnose reductase (EC 1.1.1.-)": […]
                "UDP-glucose 4,6-dehydratase (EC 4.2.1.76)": […]
            }
            ...
        return: the input_data with its original object subdata replaces with the html masked data.
        */
        var curation_roles = [], prediction_roles = [], candidate_roles = [];
        var curation_scores = [], prediction_scores = [], candidate_scores = [];
        var candidates = [];
        input_data[0] = famTreeRow(input_data[0]);  // famTreeRow
        input_data[1] = rxnRow(input_data[1]);  // rxnRow
        input_data[2] = cofaRow(input_data[2]);  // cofaRow
        input_data[3] = compartmentRow(input_data[3]);  // localRow

        // skip masking the first 4 (families/reaction/cofactor/localization rows
        for (var i=4; i<input_data.length; i++) { // 'i' is in essence the row number after the top 4 (0~3) rows
            candidates[i] = [];
            var indata = input_data[i];
            var key_arr = Object.keys(indata);  // captions for the row of genome & functional roles

            for (var k = 1; k<key_arr.length; k++) { // 'k' is in essence the column number, skip the first (0) column
                var key = key_arr[k];  // one column at a time
                var val = indata[key]; // for for one annotation table cell
                candidates[i][k] = [];
                for (var k1 = 0; k1<val.length; k1++) { // k1 is the subdata index within the table cell
                    candidates[i][k].push({'feature': val[k1]['feature'],
                                           'curation': val[k1]['curation'],
                                           'prediction': val[k1]['prediction']
                                          });
                }
                indata[key] = candidates[i][k];
            }
            input_data[i] = indata;
        }
        return input_data;
    }

    function famTreeRow(indata) {
        // re-write the family tree row by adding the protein families to a radio buttun list
        if (indata == undefined) {
            return;
        }
        var key_arr = Object.keys(indata);
        for (var k = 1; k<key_arr.length; k++) {
            var key = key_arr[k],
                val = indata[key];
            if (val && val.length > 0) {
                if (!Array.isArray(val)) {
                    val = val.split(',');
                }
                var rd_str = '<p>Select a protein family:</p>';
                val.forEach(function(item, index) {
                    rd_str += '<div><input type="radio" id="';
                    rd_str += item + '" name="' + item + '" value="' + item + '"';
                    if (rd_str.indexOf('checked') == -1) {
                        rd_str += ' checked';
                    }
                    rd_str += '><label for="' + item + '">' + item + '</label></div>';
                })
                indata[key] = rd_str;
            }
            else
                indata[key] = "<span></span>";
        }
        return indata;
    }

    function rxnRow(indata) {
        // re-write the reaction rows by adding the anchor links and allowing blank rxns
        if (indata == undefined) {
            return;
        }
        var key_arr = Object.keys(indata);
        for (var k = 1; k<key_arr.length; k++) {
            var rxnkey = key_arr[k],
                val = indata[rxnkey];
            var lnk_str ='<div style="border:1px solid black; width: 120px;">'; 
            if (val && val.length > 0) {
                if (!Array.isArray(val)) {
                    val = val.split(',');
                }
                val.forEach(function(item, index) {
                    lnk_str += '<a ui-sref="app.rxn';
                    lnk_str += '({id: \''+item+'\'})" target="_blank">'+item+'</a><br>';
                })
            }
            lnk_str += '</div>'; //<button ng-click="add_rxn($event)">Add rxn</button>';
            indata[rxnkey] = lnk_str;
        }
        return indata;
    }

    function cofaRow(indata) {
        // re-write the cofactors rows
        if (indata == undefined) {
            return;
        }
        var key_arr = Object.keys(indata);
        for (var k = 1; k<key_arr.length; k++) {
            var cfkey = key_arr[k],
                val = indata[cfkey],
                col_id = k - 1;
            // create a dropdown holding all the cofactors
            var drp_str = '<select id="sel_'+col_id+'" style="width:120px;" multiple="multiple" size=4';
            drp_str += ' ng-click="updCofactor($event, \'' +col_id+'\')">';
            drp_str += '<option>Select cpd(s)</option>';
            var cpds = Object.keys(val);
            for (var k1 = 0; k1 < cpds.length; k1++) {
                var cpd = cpds[k1];
                drp_str += '<option value="' + cpd + '"';
                if (val[cpd]) {
                    drp_str += ' selected';
                }
                drp_str += '>' + cpd + '</option>';
            }
            indata[cfkey] = drp_str + '</select>';
        }
        return indata;
    }

    function compartmentRow(indata) {
        // re-write the compartment row
        if (indata == undefined) {
            return;
        }
        var key_arr = Object.keys(indata);
        for (var k = 1; k<key_arr.length; k++) {
            var key = key_arr[k],
                val = indata[key];
            var lnk_str = '<div style="border:1px solid black; width: 120px;">';
            if (val && val.length > 0) {
                if (!Array.isArray(val)) {
                    val = val.split(',');
                }
                val.forEach(function(item, index) {
                    lnk_str += item +'<br>';
                })
            }
            lnk_str += '</div>';
            indata[key] = lnk_str;
        }
        return indata;
    }

    function buildCellHtml(curk_arr, cank_arr, prek_arr, curv_arr, canv_arr, prev_arr, row_id, col_id) {
        /*
        curk_arr: an array of curation gene_ids (string)
        cank_arr: an array of candidate gene_ids (string)
        prek_arr: an array of prediction gene_ids (string)
        curv_arr: an array of curation gene scores(string)
        canv_arr: an array of candidate gene scores (string)
        prev_arr: an array of prediction gene scores (string)
        row_id: the cell's row id (int)
        col_id: the cell's columm id (int)
        return: the html string that mask the data for a table cell at (row_id, col_id).
        */
        curk_arr = curk_arr.sort();
        cank_arr = cank_arr.sort();
        prek_arr = prek_arr.sort();
        var curk_str = '', prek_str = '', cank_str = '',
            row_col = 'row'+row_id.toString(10)+'_col'+col_id.toString(10),
            gene_id_str = '<section layout="row" layout-sm="column" layout-align="center center">';

        curk_str = '<div style="color: green;">Curations:<br><select id="cur_'+row_col+'" style="width:130px;" multiple=yes>';
        for (var j = 0; j < curk_arr.length; j++) {
            curk_str += '<option value="' + curv_arr[j]["score"] + '">';
            curk_str += curk_arr[j] + '</option>';
        }
        curk_str += '</select></div>';
        gene_id_str += curk_str;

        var btn10_str ='<div><br><md-button class="md-raised" aria-label="Add to curations" ng-click="addSelected($event, \'can_'+row_col+'\', \'cur_'+row_col+'\', \'\')">';
        btn10_str += '<md-tooltip>Add to curations</md-tooltip><=</md-button><br>';
        var btn11_str ='<md-button class="md-raised" aria-label="Remove from Curations" ng-click="removeSelected($event, \'cur_'+row_col+'\', \'can_'+row_col+'\', \'\')">';
        btn11_str += '<md-tooltip>Remove from Curations</md-tooltip>=></md-button></div>';
        gene_id_str += btn10_str + btn11_str;

        cank_str = '<div>Candidates:<br><select id="can_'+row_col+'" style="width:130px;" multiple=yes ng-dblclick="cellDblClick($event, \''+row_col+'\', \'\')">';
        for (var j = 0; j < cank_arr.length; j++) {
            cank_str += '<option value="';
            cank_str += canv_arr[j]["score"] + '"';
            if (!prek_arr.includes(cank_arr[j]) && !curk_arr.includes(cank_arr[j])) cank_str += ' style="color: red;"';
            cank_str += ' title="Double click for more...">' + cank_arr[j] + '</option>';
        }
        cank_str += '</select></div>';
        gene_id_str += cank_str;

        var btn20_str ='<div><br><md-button class="md-raised" aria-label="Add to predictions" ng-click="addSelected($event, \'can_'+row_col+'\', \'pre_'+row_col+'\', \'\')">';
        btn20_str += '<md-tooltip>Add to predictions</md-tooltip>=></md-button><br>';
        var btn21_str ='<md-button class="md-raised" aria-label="Remove from Predictions" ng-click="removeSelected($event, \'pre_'+row_col+'\', \'can_'+row_col+'\', \'\')">';
        btn21_str += '<md-tooltip>Remove from Predictions</md-tooltip><=</md-button></div>';
        gene_id_str += btn20_str + btn21_str;

        prek_str = '<div style="color: blue;">Predictions:<br><select id="pre_'+row_col+'" style="width:130px;" multiple=yes>';
        for (var j = 0; j < prek_arr.length; j++) {
            prek_str += '<option value ="' + prev_arr[j]["score"] + '">';
            prek_str += prek_arr[j] + '</option>';
        }
        prek_str += '</select></div></section>';
        gene_id_str += prek_str;
        return gene_id_str;
    }

    function buildSaveCancelHtml(cell_id) {
        var gene_list_ids = '\'cur_' + cell_id + '\', \'can_' + cell_id + '\', \'pre_' + cell_id + '\'';
        var save_cancel_str = '<section layout="row" layout-sm="column" layout-align="center center">';
        save_cancel_str += '<div>' +
            '<md-button id="save_'+cell_id+'" class="md-raised" style="right: 7px;" ng-click="save($event,'+gene_list_ids+', \'\')" ng-disabled="saveInProgress">' +
            '    {{saveAsInProgress ? saveInProgressText : \'Save\'}}' +
            '    <md-tooltip>Save change(s)</md-tooltip>' +
            '</md-button>' +
            '<md-button id="cancel_'+cell_id+'" class="md-raised" ng-click="cancel($event,'+gene_list_ids+', \'\')">' +
            '    <md-tooltip>Discard change(s)</md-tooltip>Cancel' +
            '</md-button>' +
            '<!--a ng-click="cancel($event)" class="no-link">Cancel</a-->';
        save_cancel_str += '</div></section>';
        return save_cancel_str;
    }
}])
// End Subsystem controller

// Begin ProteinFamily controller
.controller('ProteinFamily',
['$scope', '$state', '$stateParams', function($s, $state, $stateParams) {
    // console.log($stateParams);
    $s.subsysName = $stateParams.subsysName;
    $s.roleName = $stateParams.roleName;
    $s.treeName = $stateParams.treeName;
    $s.sXML = $stateParams.sXML;
    $s.xmlDownloadURL = $stateParams.xmlDownloadURL;

    // parse the xml string into an XMLDocument object
    var p = new DOMParser();
    $s.phyloxmlDoc = p.parseFromString($s.sXML, 'application/xml');
    console.log($s.phyloxmlDoc.documentElement.nodeName == "parsererror" ? "error while parsing"
                : $s.phyloxmlDoc.documentElement.nodeName);

    // display the tree via phyd3
    $s.showTree = true;

    jQuery.noConflict();
    (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
        (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
        m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
    })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
    ga('create', 'UA-61194136-8', 'auto');
    ga('send', 'pageview');

    $s.opts = {
        dynamicHide: false,
        height: 800,
        popupWidth: 300,
        invertColors: false,
        lineupNodes: true,
        showDomains: true,
        showDomainNames: false,
        showDomainColors: true,
        showGraphs: true,
        showGraphLegend: true,
        showLength: false,
        showNodeNames: true,
        showNodesType: "only leaf",
        showPhylogram: true,
        showTaxonomy: true,
        showFullTaxonomy: false,
        showSequences: false,
        showTaxonomyColors: true,
        backgroundColor: "#f5f5f5",
        foregroundColor: "#000000",
        nanColor: "#f5f5f5",
        treeWidth: 500,
        scaleX: 1,
        scaleY: 3
    };

    // function load() -- the tree part
    jQuery('#foregroundColor').val($s.opts.foregroundColor);
    jQuery('#backgroundColor').val($s.opts.backgroundColor);
    jQuery('#foregroundColorButton').colorpicker({color: $s.opts.foregroundColor});
    jQuery('#backgroundColorButton').colorpicker({color: $s.opts.backgroundColor});
    d3.select("#phyd3").text("Loading...");

    xml_file = "app/components/proteinFam/xmls/phylo_example_1.xml";
    d3.xml(xml_file, "application/xml",
    function(xml) {
        // d3.select("#phyd3").text(null);
        // var tree = phyd3.phyloxml.parse(xml);
        setContent($s.opts);
    });

    function setContent(opts) {
        d3.select("#phyd3").text(null);
        var tree = phyd3.phyloxml.parse($s.phyloxmlDoc);
        phyd3.phylogram.build("#phyd3", tree, opts);
    }

    $s.minimize = function() {
        $s.showTree = false;
    }

    $s.maximize = function() {
        $s.showTree = true;
    }

    $s.cancel = function() {
        cb(func + ' tree displayed');
        $dialog.hide();
    }

    $s.resetZoom = function() {
        // force setting the initialOpts to avoid its dynamic changing even from Object.assign({}, $s.opts)
        var initialOpts = {
            dynamicHide: false,
            height: 800,
            popupWidth: 300,
            invertColors: false,
            lineupNodes: true,
            showDomains: true,
            showDomainNames: false,
            showDomainColors: true,
            showGraphs: true,
            showGraphLegend: true,
            showLength: false,
            showNodeNames: true,
            showNodesType: "only leaf",
            showPhylogram: true,
            showTaxonomy: true,
            showFullTaxonomy: false,
            showSequences: false,
            showTaxonomyColors: true,
            backgroundColor: "#f5f5f5",
            foregroundColor: "#000000",
            nanColor: "#f5f5f5",
            treeWidth: 500,
            scaleX: 1,
            scaleY: 3
        };
        setContent(initialOpts);
    }

}])

// End ProteinFamily controller

// Begin demoSubsystem controller--For grant sponsors' convenience to review without auth
.controller('demoSubsystem',
['$scope', '$state', 'WS', 'MS','$stateParams', 'uiTools', 'Dialogs', '$http', 'Auth',
function($s, $state, WS, MS, $stateParams, tools, Dialogs, $http, Auth) {
    // serve the demo subsystem instead of returning false
    // reading the demo subsystem data from the app/components/subsystems/demo/ folder
    $s.subsysOpts = {query: '', offset: 0, sort: {field: 'Genome'}};
    $s.subsysHeader = []; // dynamically filled later
    $s.subsysData = [];
    $s.subsysName = 'demo_Zn_subsystem';
    //$s.subsysName = 'demo_UDP_Bio';
    $s.subsysPath = '';
    $s.subsysDataClone = [];
    $s.allSubsysFamTrees = [];
    $s.mySubsysFamTrees = [];
    $s.captions = [];

    var demo_sys_file = $s.subsysName + '.json'; // 'demo_UDP_Bio.json'; // 'demo_Zn_subsystem.json';
    $s.loading = true
    var demo_dir = 'app/components/subsystems/demo',
        demo_subsys_file_path = [demo_dir, demo_sys_file].join('/'),
        demo_data = [], demo_res = null, demo_meta = null;

    $http.get(demo_subsys_file_path)
      .then(function(response) {
        demo_res = response.data;
        demo_meta = demo_res.meta
        demo_data = demo_res.data;
        $s.subsysName = demo_data.name;
        $s.subsysPath = demo_dir;
        $s.subsysDataClone = Object.assign({}, demo_data.data);
        parseSubsysData(demo_data.data);
        $s.subsysData = buildHtmlContent($s.subsysData);
        // subsystem table header
        $s.subsysHeader[0] = {label: $s.captions[0], key: $s.captions[0]};
        for (var k=1; k<$s.captions.length; k++) {
            $s.subsysHeader[k] = {label: $s.captions[k], key: $s.captions[k], column_id: k, formatter: function(row) {
                return '<span>'+row+'</span>';
            }
        }}
        // list all family trees under the subsystems/families folder
        MS.listAllSubsysFamilyTrees()
        .then(function(subsysTrees) {
                $s.allSubsysFamTrees = subsysTrees;
                WS.cached.allSubsysFamTrees = subsysTrees;
            }).catch(function(e) {
                $s.allSubsysFamTrees = [];
            })
        $s.listAllSubsysFamTrees = false;
        $s.loading = false;
    })
    .catch(function(error) {
        console.log('Caught an error: "' + (error.error.message).replace(/_ERROR_/gi, '') + '"');
        $s.listAllSubsysFamTrees = false;
        $s.loading = false;
    })

    $s.save = function(data) {}

    // Parse the given data for the subsystem data structure
    function parseSubsysData(obj_data) {
        // convert the subsystem data into an array of objects from an array of arrays
        // returns an array of objects, where each object represents a row of data in the subsystem table:
        // The first row of data is the respective reactions where each function role (column caption) is associated.
        // The rows after the first consist of gene annotation details in arrays of geneIds under the categories of
        // 'curation'/'candidates'/'predictions'
        var caps = ["Genome"], families = {};
        // fetching the subsystem head captions and family trees
        for (var i0=1; i0<obj_data[0].length; i0++) {
            var obj = obj_data[0][i0];
            if (typeof obj === 'object') {
                caps.push(obj.role);
                families[obj.role] = obj.families;
            }
        }
        var data = [];
        for (var i=1; i<obj_data.length; i++) {
            data[i-1] = {};
            for (var j=0; j<caps.length; j++) {
                data[i-1][caps[j]] = obj_data[i][j];
            }
        }
        $s.captions = caps;
        $s.subsysData = data;
        $s.mySubsysFamTrees = families;
    }

    // With the given data from the NEW subsystem data structure, build the html content for table cells
    function buildHtmlContent(input_data) {
        /*
        input_data: has a structure of an array of objects.  Examples of input_data rows:
        1st row:
            input_data[0] = {Genome: "Reactions",
                "UDP-4-dehydro-6-deoxy-glucose 3,5-epimerase (no EC)": "rxn02735",
                "UDP-4-dehydro-rhamnose reductase (EC 1.1.1.-)": "rxn02735",
                "UDP-glucose 4,6-dehydratase (EC 4.2.1.76)": "rxn00215"
            }
        2nd (and other) row:
            input_data[1]= {
                Genome: "Acomosus"
                "UDP-4-dehydro-6-deoxy-glucose 3,5-epimerase (no EC)": {
                    candidates: (6) [
                        {"Aco000396.1": {score: "0.855"}},
                        {"Aco006021.1": {score: "0.845"}}...],
                    curation: []
                    prediction: (5) […]
                },
                "UDP-4-dehydro-rhamnose reductase (EC 1.1.1.-)": {…}
                "UDP-glucose 4,6-dehydratase (EC 4.2.1.76)": {…}
            }
            ...
        return: the input_data with its original object subdata replaces with the html masked data.
        */
        var curation_roles = [], prediction_roles = []; candidate_roles = [];
        var curation_scores = [], prediction_scores = []; candidate_scores = [];
        input_data[0] = rxnRow(input_data[0]);

        for (var i=1; i<input_data.length; i++) { // i=1 to skip masking the reaction row
            curation_roles[i] = {};
            prediction_roles[i] = {};
            candidate_roles[i] = {};
            curation_scores[i] = {};
            prediction_scores[i] = {};
            candidate_scores[i] = {};
            var indata = input_data[i];
            var key_arr = Object.keys(indata);
            for (var k = 1; k<key_arr.length; k++) { // k=1 to skip masking the genome column
                key = key_arr[k];
                curation_roles[i][key] = [];
                prediction_roles[i][key] = [];
                candidate_roles[i][key] = [];
                curation_scores[i][key] = [];
                prediction_scores[i][key] = [];
                candidate_scores[i][key] = [];
                var val = indata[key];
                if (typeof val === 'object' && key != 'Genome') {
                    Object.keys(val).forEach(function(sub_key) {
                        switch(sub_key) {
                            case 'curation':
                              // curation roles
                              Object.keys(val[sub_key]).forEach(function(ssubK) {
                                var curk_arr = Object.keys(val[sub_key][ssubK]);
                                var curv_arr = Object.values(val[sub_key][ssubK]);
                                curation_roles[i][key] = curation_roles[i][key].concat(curk_arr);
                                curation_scores[i][key] = curation_roles[i][key].concat(curv_arr);
                              });
                              break;
                            case 'prediction':
                              // prediction roles
                              Object.keys(val[sub_key]).forEach(function(ssubK) {
                                var prek_arr = Object.keys(val[sub_key][ssubK]);
                                var prev_arr = Object.values(val[sub_key][ssubK]);
                                prediction_roles[i][key] = prediction_roles[i][key].concat(prek_arr);
                                prediction_scores[i][key] = prediction_scores[i][key].concat(prev_arr);
                              });
                              break;
                            case 'candidates':
                              // candidate roles
                              Object.keys(val[sub_key]).forEach(function(ssubK) {
                                var cank_arr = Object.keys(val[sub_key][ssubK]);
                                var canv_arr = Object.values(val[sub_key][ssubK]);
                                candidate_roles[i][key] = candidate_roles[i][key].concat(cank_arr);
                                candidate_scores[i][key] = candidate_scores[i][key].concat(canv_arr);
                              });
                              break;
                            default:
                              // do nothing
                              break;
                        }
                    });
                    indata[key] = buildCellHtml(curation_roles[i][key], candidate_roles[i][key], prediction_roles[i][key],
                                                curation_scores[i][key], candidate_scores[i][key], prediction_scores[i][key], i, k);
                }
            }
            input_data[i] = indata;
        }
        return input_data;
    }

    function rxnRow(indata) {
        // re-write the reaction row by adding the anchor links and allowing blank rxns
        var key_arr = Object.keys(indata);
        for (var k = 1; k<key_arr.length; k++) {
            var key = key_arr[k],
                val = indata[key];
            var lnk_arr = [];
            if (val !== '') {
                val.split(',').forEach(function(item, index) {
                    lnk_arr.push('<a ui-sref="app.rxn({id: \''+item+'\'})" target="_blank">'+item+'</a>');
                })
                indata[key] = lnk_arr.join(',');
            }
            else
                indata[key] = "<span></span>";
        }
        return indata;
    }

    function buildCellHtml(curk_arr, cank_arr, prek_arr, curv_arr, canv_arr, prev_arr, row_id, col_id) {
        curk_arr = curk_arr.sort();
        cank_arr = cank_arr.sort();
        prek_arr = prek_arr.sort();
        var curk_str = '', prek_str = '', cank_str = '',
            row_col = 'row'+row_id.toString(10)+'_col'+col_id.toString(10),
            gene_id_str = '<section layout="row" layout-sm="column" layout-align="center center">';

        curk_str = '<div style="color: green;">Curations:<br><select id="cur_'+row_col+'" style="width:130px;" multiple=yes>';
        for (var j = 0; j < curk_arr.length; j++) {
            curk_str += '<option value="' + curv_arr[j]["score"] + '">';
            curk_str += curk_arr[j] + '</option>';
        }
        curk_str += '</select></div>';
        gene_id_str += curk_str;

        var btn10_str ='<div><br><md-button class="md-raised" aria-label="Add to curations" ng-click="addSelected($event, \'can_'+row_col+'\', \'cur_'+row_col+'\', \'\')">';
        btn10_str += '<md-tooltip>Add to curations</md-tooltip><=</md-button><br>';
        var btn11_str ='<md-button class="md-raised" aria-label="Remove from Curations" ng-click="removeSelected($event, \'cur_'+row_col+'\', \'can_'+row_col+'\', \'\')">';
        btn11_str += '<md-tooltip>Remove from Curations</md-tooltip>=></md-button></div>';
        gene_id_str += btn10_str + btn11_str;

        cank_str = '<div>Candidates:<br><select id="can_'+row_col+'" style="width:130px;" multiple=yes ng-dblclick="cellDblClick($event, \''+row_col+'\', \'\')">';
        for (var j = 0; j < cank_arr.length; j++) {
            cank_str += '<option value="';
            cank_str += canv_arr[j]["score"] + '"';
            if (!prek_arr.includes(cank_arr[j]) && !curk_arr.includes(cank_arr[j])) cank_str += ' style="color: red;"';
            cank_str += ' title="Double click for more...">' + cank_arr[j] + '</option>';
        }
        cank_str += '</select></div>';
        gene_id_str += cank_str;

        var btn20_str ='<div><br><md-button class="md-raised" aria-label="Add to predictions" ng-click="addSelected($event, \'can_'+row_col+'\', \'pre_'+row_col+'\', \'\')">';
        btn20_str += '<md-tooltip>Add to predictions</md-tooltip>=></md-button><br>';
        var btn21_str ='<md-button class="md-raised" aria-label="Remove from Predictions" ng-click="removeSelected($event, \'pre_'+row_col+'\', \'can_'+row_col+'\', \'\')">';
        btn21_str += '<md-tooltip>Remove from Predictions</md-tooltip><=</md-button></div>';
        gene_id_str += btn20_str + btn21_str;

        prek_str = '<div style="color: blue;">Predictions:<br><select id="pre_'+row_col+'" style="width:130px;" multiple=yes>';
        for (var j = 0; j < prek_arr.length; j++) {
            prek_str += '<option value ="' + prev_arr[j]["score"] + '">';
            prek_str += prek_arr[j] + '</option>';
        }
        prek_str += '</select></div></section>';
        gene_id_str += prek_str;
        return gene_id_str;
    }

    function buildSaveCancelHtml(cell_id) {
        var gene_list_ids = '\'cur_' + cell_id + '\', \'can_' + cell_id + '\', \'pre_' + cell_id + '\'';
        var save_cancel_str = '<section layout="row" layout-sm="column" layout-align="center center">';
        save_cancel_str += '<div>' +
            '<md-button id="save_'+cell_id+'" class="md-raised" style="right: 7px;" ng-click="save($event,'+gene_list_ids+', \'\')" ng-disabled="saveInProgress">' +
            '    {{saveAsInProgress ? saveInProgressText : \'Save\'}}' +
            '    <md-tooltip>Save change(s)</md-tooltip>' +
            '</md-button>' +
            '<md-button id="cancel_'+cell_id+'" class="md-raised" ng-click="cancel($event,'+gene_list_ids+', \'\')">' +
            '    <md-tooltip>Discard change(s)</md-tooltip>Cancel' +
            '</md-button>' +
            '<!--a ng-click="cancel($event)" class="no-link">Cancel</a-->';
        save_cancel_str += '</div></section>';
        return save_cancel_str;
    }

    $s.showDemoIntro = function(ev, pid, title, msg='Thank you for visiting the subsystem page!') {
        msg = '';
        msg += 'whatever details here';

        Dialogs.showAdvanced(ev, pid, title, msg);
    }
}])
// End demoSubsystem controller--For sponsors' convenience to review without auth
