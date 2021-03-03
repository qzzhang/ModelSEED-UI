/**
 * [module Dialogs]
 *
 * Set of dialogs and toast notifications.
 *
 */

angular.module('Dialogs', [])

.service('Dialogs',
['MS', 'WS', '$mdDialog', '$mdToast', 'uiTools', '$timeout', 'Upload', 'Auth',
'ModelViewer', 'config', '$http', '$document',
function(MS, WS, $dialog, $mdToast, uiTools, $timeout, Upload, Auth, MV, config, $http, $document) {
    var self = this;

    this.showMeta = function(ev, path) {
        ev.stopPropagation();
        $dialog.show({
            templateUrl: 'app/views/dialogs/show-meta.html',
            targetEvent: ev,
            clickOutsideToClose: true,
            controller: ['$scope', '$http',
            function($s, $http) {
                $self = $s;
                $s.editMeta = false;
                $s.edit = {userMeta: '', autoMeta: ''};
                $s.validJSON = true;

                $s.loading = true;

                WS.getObjectMeta(path)
                  .then(function(meta) {
                      $s.meta = meta[0];

                      if ( Object.keys($s.meta[7]).length === 0 ) $s.userMeta = null;
                      else $s.userMeta = JSON.stringify($s.meta[7], null, 4);

                      if ( Object.keys($s.meta[8]).length === 0 ) $s.autoMeta = null;
                      else $s.autoMeta = JSON.stringify($s.meta[8], null, 4);

                      $s.loading = false;
                  })

                $s.editUserMeta = function() {
                    $s.editMeta = !$s.editMeta;
                }

                $s.saveMeta = function(meta) {
                    $s.savingMeta = true;
                    WS.saveMeta($s.meta[2] + $s.meta[0], meta)
                      .then(function(newMeta) {
                          $s.userMeta = JSON.stringify(newMeta, null, 4);
                          $s.editMeta = false, $s.savingMeta = false;
                      })
                }

                WS.getPermissions(path)
                  .then(function(blah) {

                  })

                $s.tidy = function(text) {
                    $s.edit.userMeta = JSON.stringify(JSON.parse(text), null, 4)
                }

                $s.validateJSON = function(text) {
                    try {
                        var meta = JSON.parse(text);
                        $s.validJSON = true;
                    } catch(err) { $s.validJSON = false }
                }

                $s.cancel = function(){
                    $dialog.hide();
                }
            }]
        })
    }

    this.showGeneData = function(ev, geneObj, col_k, cb) {
        ev.stopPropagation();
        $dialog.show({
            templateUrl: 'app/views/dialogs/show-gene.html',
            targetEvent: ev,
            clickOutsideToClose: true,
            controller: ['$scope', '$http',
            function($s, $http) {
                $self = $s;
                $s.validNumber = true;
                $s.geneannos = ['curation', 'prediction', 'neither'];

                $s.showGene = true;
                $s.cssText1 = "max-width:1000px;width:90%;height:90%;";
                $s.cssText2 = "max-width:1000px;width:90%;height:90%;";

                $s.gene = geneObj; // the selected item
                $s.geneFeature = geneObj['feature'];
                $s.funcName = col_k;
                $s.date_annotated = '';

                $s.annoOldGroup = {'curation': geneObj['curation'],
                                   'prediction': geneObj['prediction']};

                var evd_codes = geneObj['evidence_codes'] ? geneObj['evidence_codes'] : [];
                $s.evidence_codes = (evd_codes.length>0) ? evd_codes : [];
                $s.annotation = geneObj['annotation'] || {};
                var start_mod_hist = {
                    "curation": $s.annoOldGroup['curation'],
                    "prediction": $s.annoOldGroup['prediction'],
                    "genesInvolved": $s.geneFeature,
                    "user": Auth.user
                };
                $s.mod_history = $s.annotation['mod_history'] || [start_mod_hist];
                $s.hist_len = $s.mod_history.length;

                $s.has_gene_anno = false;
                $s.has_ec_anno = false;
                $s.rmedHist = false;

                function updateSelectedAnno() {
                    if ($s.gene['curation'] == 1) {
                        $s.selected = 'curation';
                    } else if ($s.gene['prediction'] == 1) {
                        $s.selected = 'prediction';
                    } else {
                        $s.selected = 'neither';
                    }
                    $s.has_gene_anno = false;
                }

                function updateLastEvcode(evc_val, cmt_val, doi2_val) {
                    $s.evc_value = evc_val || 'evidence code';
                    $s.cmt_value = cmt_val || 'comment';
                    $s.doi2_value = doi2_val || 'DOI';
                    $s.has_ec_anno = false;
                }

                $s.addEvdCode = function(ec_id, cm_id, doi_id) {
                    var ec = document.getElementById(ec_id),
                        cm = document.getElementById(cm_id),
                        doi2 = document.getElementById(doi_id);
                    $s.new_ec_hist = {};
                    if ($s.evidence_codes.includes(ec.value)) {
                        $s.has_ec_anno = false;
                        return;
                    }

                    var ec_date = new Date().toISOString().slice(0, 10);
                    $s.date_annotated = ec_date;
                    $s.evidence_codes.push(ec.value);
                    $s.new_ec_hist = {
                        "evidence_code": ec.value,
                        "user": Auth.user,
                        "comment": cm.value,
                        "DOI": doi2.value,
                        "genesInvolved": $s.geneFeature,
                        "date_annotated": ec_date
                    };
                    $s.has_ec_anno = true;
                }

                function addEC2ModHist(new_hist) {
                    for (var i=0; i<$s.mod_history.length; i++) {
                        if ($s.mod_history[i]['evidence_code']==new_hist['evidence_code']
                            && $s.mod_history[i]['comment']==new_hist['comment']
                            && $s.mod_history[i]['DOI']==new_hist['DOI']
                            && $s.mod_history[i]['date_annotated']==new_hist['date_annotated']) {
                                return false;
                        }
                    }
                    $s.mod_history.push(new_hist);
                    return true;
                }

                // Not only remove the last change record, but also reverse the change of the annotation
                $s.rmModHist = function(mh_ind) {
                    var mh = $s.mod_history[mh_ind];
                    var is_ech = 'evidence_code' in mh;
                    if (confirm("Remove modification record:\n" + JSON.stringify(mh) +"?")) {
                        if (mh_ind >= $s.hist_len && mh_ind == $s.mod_history.length - 1) {
                            $s.mod_history.pop();
                            if (is_ech) {
                                $s.evidence_codes.pop();
                                updateLastEvcode();
                            } else {
                                // set the scope values one step back
                                setAnnoSelected(mh_ind - 1);
                            }
                            $s.gene['annotation']['mod_history'] = $s.mod_history;
                            cb($s.gene);
                            return true;
                        }
                        else {
                            return false;
                        }
                    }
                }

                updateSelectedAnno();
                $s.annoNewGroup = {};
                $s.annoSelectedChanged = function(sel_id) {
                    var to_be_changed = false;
                    if ($s.selected == 'curation') {
                        if ($s.gene['curation'] != 1) {
                            $s.annoNewGroup = {'curation': 1, 'prediction': 0};
                            to_be_changed = true;
                        }
                    } else if ($s.selected == 'prediction') {
                        if ($s.gene['curation'] == 1) {
                            if (confirm("This gene is already curated, are you sure?")) {
                                $s.annoNewGroup = {'prediction': 1, 'curation': 0};
                                to_be_changed = true;
                            }
                        } else {
                            $s.annoNewGroup = {'prediction': 1, 'curation': 0};
                            to_be_changed = true;
                        }
                    } else {
                        if ($s.gene['curation'] == 1) {
                            if (confirm("This gene is already curated, are you sure?")) {
                                $s.annoNewGroup = {'prediction': 0, 'curation': 0};
                                to_be_changed = true;
                            }
                        } else {
                            $s.annoNewGroup = {'prediction': 0, 'curation': 0};
                            to_be_changed = true;
                        }
                    }
                    if (to_be_changed) {
                        createAnnoChangeHist();
                    } else { // reverse the selection if no change is to be made
                        syncSelectedWithGene();
                    }
                }

                // set values in the current window display and in the gene for callback
                function setAnnoSelected(n) {
                    var hst = $s.mod_history[n];
                    while ('evidence_code' in hst) {
                        hst = $s.mod_history[n - 1];
                        n = n - 1;
                    }
                    if ('curation' in hst && 'prediction' in hst) {
                        $s.gene['curation'] = hst['curation'];
                        $s.gene['prediction'] = hst['prediction'];
                        updateSelectedAnno();
                    }
                }

                function syncSelectedWithGene() {
                    $s.selected = $s.gene['curation'] ? 'curation' : ($s.gene['prediction'] ? 'prediction' : 'neither');
                }
                function createAnnoChangeHist() {
                    if ($s.annoNewGroup['curation'] == $s.annoOldGroup['curation']
                        && $s.annoNewGroup['prediction'] == $s.annoOldGroup['prediction']) {
                            $s.has_gene_anno = false;
                            syncSelectedWithGene();
                            return;
                    }
                    var anno_date = new Date().toISOString().slice(0, 10);
                    $s.date_annotated = anno_date;
                    $s.has_gene_anno = true;
                }

                function addAnno2ModHist() {
                    $s.new_anno_hist = {};
                    var cmg = document.getElementById('cmg'),
                        doi1 = document.getElementById('doi1');
                    $s.new_anno_hist = {
                        "curation": $s.annoNewGroup['curation'],
                        "prediction": $s.annoNewGroup['prediction'],
                        "function": col_k,
                        "comment": cmg.value,
                        "genesInvolved": $s.geneFeature,
                        "user": Auth.user,
                        "date_annotated": $s.date_annotated,
                        "DOI": doi1.value
                    };
                    if (findHist($s.new_anno_hist)) {
                        $s.has_gene_anno = false;
                        return false;
                    }
                    $s.mod_history.push($s.new_anno_hist);
                    return true;
                }

                function findHist(new_hist) {
                    for (var i=0; i<$s.hist_len; i++) {
                        if ($s.mod_history[i]['curation']==new_hist['curation']
                            && $s.mod_history[i]['prediction']==new_hist['prediction']
                            && $s.mod_history[i]['user']==new_hist['user']) {
                            /*
                            && $s.mod_history[i]['function']==$s.new_anno_hist['function']
                            && $s.mod_history[i]['comment']==$s.new_anno_hist['comment']
                            && $s.mod_history[i]['DOI']==$s.new_anno_hist['DOI']
                            && $s.mod_history[i]['date_annotated']==$s.new_anno_hist['date_annotated']) {*/
                            return true;
                        }
                    }
                    return false;
                }

                $s.submitChanges = function() {
                    var anno_changed = false, ec_added = false;
                    if ($s.has_gene_anno && addAnno2ModHist()) {
                        $s.gene['curation'] = $s.new_anno_hist['curation'];
                        $s.gene['prediction'] = $s.new_anno_hist['prediction'];
                        anno_changed = true;
                    }
                    if ($s.has_ec_anno && addEC2ModHist($s.new_ec_hist)) {
                        $s.gene['evidence_codes'] = $s.evidence_codes;
                        ec_added = true;
                    }
                    if ( $s.rmedHist || anno_changed || ec_added) {
                        $s.gene['annotation']['mod_history'] = $s.mod_history;

                        $s.has_gene_anno = false;
                        $s.has_ec_anno = false;
                        $s.rmedHist = false;;
                        cb($s.gene);
                    }
                    // $dialog.hide();
                }

                $s.validateNumber = function(text) {
                    // If text is Not a Number or less than 0 or greater than 1.0
                    if (isNaN(text) || text < 0 || text > 1) {
                        $s.validNumber = false;
                    } else {
                        $s.validnumber = true;
                    }
                }

                $s.cancel = function(){
                    $dialog.hide();
                }

                $s.minimize = function() {
                    $s.cssText1 = "position: fixed; bottom: 45px; right: 28px; width: 600px;";
                    $s.showGene = false;
                }

                $s.maximize = function() {
                    $s.cssText1 = "max-width:1000px;width:80%;height:80%;";
                    $s.showGene = true;
                }

                $s.dblclick = function() {
                    if ($s.showGene)
                        $s.minimize();
                    else
                        $s.maximize();
                }

            }]
        })
    }

    this.showFuncFamTree = function(ev, tree, ftr, download_path, phyloxml, cb) {
        var parentEl = angular.element(document.body);
        ev.stopPropagation();
        $dialog.show({
            //parent: parentEl,
            //multiple: true,
            templateUrl: 'app/views/dialogs/show-famTree.html',
            targetEvent: ev,
            clickOutsideToClose: false,
            controller: ['$scope', '$http',
            function($s, $http) {
                $self = $s;
                $s.showTree = true;
                $s.treeName = tree;
                $s.featureName = ftr;
                $s.pinnedTreeNodes = [];
                $s.propagateTreeNodes = [];
                $s.pinnedNodes = [];
                $s.tree = {
                    branchset: [],
                    properties: [],
                    taxonomies: [],
                    sequences: [],
                    confidences: [],
                    references: [],
                    branchLength: 0.0
                };
                $s.cssText1 = "max-width:1500px;width:100%;height:100%;overflow:hidden;";
                $s.cssText2 = "max-width:1500px;width:100%;height:100%;overflow:hidden;";

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
                    pinnedNodes: [],
                    //popupAction: $s.updateSelectedNodes,
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
                    treeWidth: 300,
                    scaleX: 1,
                    scaleY: 3
                };
                $s.downloadURL = download_path;

                // function load() -- the tree part
                jQuery('#foregroundColor').val($s.opts.foregroundColor);
                jQuery('#backgroundColor').val($s.opts.backgroundColor);
                jQuery('#foregroundColorButton').colorpicker({color: $s.opts.foregroundColor});
                jQuery('#backgroundColorButton').colorpicker({color: $s.opts.backgroundColor});
                d3.select("#phyd3").text("Loading...");

                //console.log('xml string from xmldoc outerHTML:\n' + phyloxml.firstChild.outerHTML);
                /* passing the phyloxml doc to phyd3.phylogram.build directly
                   instead of through d3.xml call yet still passing the phyloxml doc does NOT work
                d3.select("#phyd3").text(null);
                var tree = phyd3.phyloxml.parse(phyloxml);
                phyd3.phylogram.build("#phyd3", tree, $s.opts);
                */
                //**First reading the phylo_example_1.xml file and then in the callback pass phyloxml doc WORKS!
                xml_file = "app/components/proteinFam/xmls/phylo_example_1.xml";
                d3.xml(xml_file, "application/xml",
                function(xml) {
                    // d3.select("#phyd3").text(null);
                    // var tree = phyd3.phyloxml.parse(xml);
                    setContent($s.opts);
                });

                $s.minimize = function() {
                    $s.cssText1 = "position: fixed; bottom: 45px; right: 28px; width: 800px;";
                    $s.showTree = false;
                }

                $s.maximize = function() {
                    $s.cssText1 = "max-width:1500px;width:100%;height:100%;overflow:hidden;";
                    $s.showTree = true;
                }

                $s.dblclick = function() {
                    if ($s.showTree)
                        $s.minimize();
                    else
                        $s.maximize();
                }

                var addSelectedNodes = function(nd) {
                    if(!$s.pinnedTreeNodes.find(ele => ele.indexOf(nd) >= 0)) {
                        if( nd.indexOf('||') !== -1) {
                            $s.pinnedTreeNodes.push(nd);
                        }
                    }
                }

                var getBranchNodeNames = function(brch_arr) {
                    if(brch_arr.length === 0) {
                        return true;
                    }
                    brch_arr.forEach((brch) => {
                        addSelectedNodes(brch.name);
                        sub_branches = brch['branchset'];
                        getBranchNodeNames(sub_branches);
                    })
                }

                var searchNameInPhylotreeById = function(varToSearch, phylotree) {
                    if(phylotree['id'] && phylotree['id'] === varToSearch) {
                        var ret_name = phylotree['name'];
                        // console.log('node name: '+ret_name+' for node id: '+varToSearch);
                        addSelectedNodes(ret_name);
                        var sub_tree = phylotree['branchset'];  // subtree
                        if(sub_tree) {
                            getBranchNodeNames(sub_tree);
                        }
                        return true;
                    }

                    var branch_arr = phylotree['branchset'];  // subtree
                    branch_arr.forEach((branch) => {
                        searchNameInPhylotreeById(varToSearch, branch);
                    })
                }

                $s.$watch('opts.pinnedNodes', function(newValue, oldValue, $s) {
                    $s.pinnedTreeNodes = [];
                    if ($s.opts.pinnedNodes) {
                        // parse for selected tree node names from ids for $s.pinnedTreeNodes.toString());
                        for (var ni = 0; ni < $s.opts.pinnedNodes.length; ni++) {
                            var t_id = $s.opts.pinnedNodes[ni];
                            searchNameInPhylotreeById(t_id, $s.tree);
                        }
                    }
                }, true)

                $s.refreshAnnotation = function() {
                    $s.propagateTreeNodes = [];
                    // get a HTMLCollection of elements in the pinnedTreeNodes box
                    var opt_coll = document.getElementById('sel_genes').options;

                    // convert to an array using Array.from()
                    Array.from(opt_coll).forEach((coll) => {
                        if (coll.selected) $s.propagateTreeNodes.push(coll.value.trim());
                    })
                    cb($s.propagateTreeNodes);
                }

                $s.cancel = function() {
                    $dialog.hide();
                }

                $s.resetZoom = function() {
                    // force setting the initialOpts to avoid its dynamic changing even from Object.assign({}, $s.opts)
                    var initialOpts = {
                        dynamicHide: false,
                        height: 800,
                        popupWidth: 300,
                        pinnedNodes: [],
                        //popupAction: updateSelectedNodes,
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
                        treeWidth: 300,
                        scaleX: 1,
                        scaleY: 3
                    };
                    setContent(initialOpts);
                }

                function setContent(opts) {
                    $s.pinnedNodes = opts.pinnedNodes;
                    d3.select("#phyd3").text(null);
                    $s.tree = phyd3.phyloxml.parse(phyloxml);
                    // console.log('****The parsed phylotree by phyD3:'+JSON.stringify($s.tree));
                    phyd3.phylogram.build("#phyd3", $s.tree, opts);
                }
            }]
        })
    }

    this.showInfo = function(info, pinTo, pel) {
        $mdToast.show(
            $mdToast.simple()
            .content(info)
            .position(pinTo)
            .hideDelay(6000))
            .parent(pel)  // parent element
          .then(function() {
            consol.log('Toast dismissed.');
          }).catch(function() {
            console.log('Toast failed or was forced to close early by another toast.');
          });
    }

    this.showError = function(msg) {
       $mdToast.show({
        controller: 'ToastCtrl',
        parent: angular.element('.sidebar'),
        //templateUrl:'app/views/dialogs/notify.html',
        template: '<md-toast>'+
                        '<span flex style="margin-right: 30px;">'+
                          '<span class="ms-color-error">Error</span><br>'+
                          msg+
                         '</span>'+
                    '</md-toast>',
        hideDelay: 10000
      });
    }

    this.showAlert = function(ev, parentID, title, msg) {
        // Appending dialog to document.body to cover sidenav in docs app
        // Modal dialogs should fully cover application
        // to prevent interaction outside of dialog
        $dialog.show(
          $dialog.alert()
            .parent(angular.element(document.querySelector('#'+ parentID)))
            .clickOutsideToClose(true)
            .title(title)  //T his is an alert title
            .content(msg)  // You can specify some description text in here
            .ariaLabel(title)
            .ok('OK!')
            .targetEvent(ev)
        );
      };

    this.showAdvanced = function(ev, parentID, title, msg) {
        $dialog.show({
            templateUrl: 'app/views/dialogs/show-advanced-msg.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            clickOutsideToClose:true,
            controller: ['$scope', '$mdDialog',
              function($scope, $dialog) {
                $scope.hide = function() {
                    $dialog.hide();
                };
                $scope.cancel = function() {
                    $dialog.cancel();
                };
                $scope.answer = function(answer) {
                    $dialog.hide(answer);
                };
            }]
      })
    }

    this.selectMedia = function(ev, cb) {
        ev.stopPropagation();
        $dialog.show({
            templateUrl: 'app/views/dialogs/selectMedia.html',
            targetEvent: ev,
            clickOutsideToClose: true,
            controller: ['$scope', '$http',
              function($scope, $http) {
                $scope.select = function(){
                    // Simply use whatever media set to MV.selectedMedium
                    cb(MV.selectedMedium);
                    $dialog.hide();
                };
                $scope.setDefault = function(){
                    // Set MV.selectedMedium back to 'Complete'
                    MV.selectedMedium = 'Complete';
                    cb(MV.selectedMedium);
                    $dialog.hide();
                };
                $scope.cancel = function(){ // reverse setting of MV.selectedMedium
                    MV.selectedMedium = MV.pre_Medium;
                    cb(MV.selectedMedium);
                    $dialog.hide();
                };
              }]
        });
    }

    this.reconstruct = function(ev, item, cb) {
        ev.stopPropagation();
        $dialog.show({
            templateUrl: 'app/views/dialogs/reconstruct.html',
            targetEvent: ev,
            clickOutsideToClose: true,
            controller: ['$scope', '$http',
              function($scope, $http) {
                $scope.item = item;
                $scope.form = {genome: item.path};

            	$scope.selectedKingdom = []; // Plants or Microbes
            	$scope.selectedSeqType = []; // protein or DNA
            	$scope.selectedTaxa = []; // genome_type: features or contigs
            	$scope.selectedTemplate = [];
            	
                // Kingdom dropdown options
                $scope.kingdomOptions = [{
            	   name: 'plants', 
            	   value: 'Plants'
            	}, {
                   name: 'microbes', 
                   value: 'Microbial'                    	
            	}];

                // Sequence Type dropdown options
                $scope.seqTypeOptions = [{
                	name: 'dna', 
                    value: 'DNA'
            	}, {
            		name: 'protein', 
            		value: 'Protein'                           	
            	}];
                
                // Genome Type dropdown options
                $scope.taxaOptions = [{
                	   name: 'microbial_contigs',
                	   value: 'Contigs'
                	}, {
                       name: 'microbial_features', 
                       value: 'Microbial feature or Protein sequences'            
                        	
                	}];
                
                // Template dropdown options
                $scope.options = [{
                	   name: 'plant', 
                	   value: 'Plant template'
                	}, {
                	   name: 'auto',
                	   value: 'Automatically select'
                	}, {
                       name: 'core', 
                       value: 'Core template'            
                	}, {
                        name: 'grampos', 
                        value: 'Gram positive template'
                	}, {
                        name: 'gramneg', 
                        value: 'Gram negative template'            	
                	}];
                            	
            	

                $scope.reconstruct = function(){
                    self.showToast('Reconstructing', item.name, 5000)
                    
                    
                    /*
		         	var kingdom = "";
		            if( this.selectedKingdom && this.selectedKingdom.length==0 ) {
		            	// Set the default:
		            	this.selectedKingdom["name"] = "plants";
		                kingdom = this.selectedKingdom["name"];
		            } else {
		                kingdom = this.selectedKingdom["name"];
		            }
		                        
		          	var seq_type = "";
		            if( this.selectedSeqType && this.selectedSeqType.length==0 ) {
		            	// Set the default:
		            	this.selectedSeqType["name"] = "dna";
		                seq_type = this.selectedSeqType["name"];
		            } else {
		                seq_type = this.selectedSeqType["name"];
		            }
		            */        	
		          	var genome_type = "";
		            if( this.selectedTaxa && this.selectedTaxa.length==0 ) {
		            	// Set the default:
		            	this.selectedTaxa["name"] = "microbial_contigs";
		                genome_type = this.selectedTaxa["name"];
		            } else {
		                genome_type = this.selectedTaxa["name"];
		            }
		                    	
		          	var template = "";
		            if( this.selectedTemplate && this.selectedTemplate.length==0 ) {
		            	// Set the default:
		            	this.selectedTemplate["name"] = "auto";
		            	template = this.selectedTemplate["name"];
		            } else {
		            	template = this.selectedTemplate["name"];
		            }

		        	var name = $scope.form.output_file || "";
                    if( name.length == 0 ) {
		        		
		                var parameters = { genome: item.path, genome_type: genome_type }; // Is Ok to omit the output_file arg


		        		// Gets: _ERROR_Object name PATRIC:1123738.3 contains forbidden characters!_ERROR_:
		                // var parameters = { genome: item.path, output_file: item.path, genome_type: genome_type };
		        	} else {
		        		// Enable entering the optional model name
		            	// Validate name to assign to the new model
		                var regex = /[^\w]/gi;
		                if( regex.test( name ) == true ) {

                            $scope.form.output_file = "Invalid Model Name, using the default!";

			                var parameters = { genome: item.path, genome_type: genome_type }; // Is Ok to omit the output_file arg
			                
			        		// Gets: _ERROR_Object name PATRIC:1123738.3 contains forbidden characters!_ERROR_:
			                // var parameters = { genome: item.path, output_file: item.path, genome_type: genome_type };
		                } else {
		                	
		                	// Assert: Optional name was entered and was validated
		                    var parameters = { genome: item.path, genome_type: genome_type, output_file: name };
		                }
                    }
                    
                    MS.reconstruct( parameters )
                    // MS.reconstruct($scope.form)
                      .then(function(jobId) {
                           cb(jobId);
                      }).catch(function(e) {
                          self.showError('Reconstruct Error', e.error.message.slice(0,30)+'...')
                      })

                    $dialog.hide();
                };

                $scope.cancel = function(){
                    $dialog.hide();
                };
              }]
        });
    }

    this.reconstructPlant = function(ev, item, cb) {
        ev.stopPropagation();
        $dialog.show({
            templateUrl: 'app/views/dialogs/reconstruct-plant.html',
            targetEvent: ev,
            clickOutsideToClose: true,
            controller: ['$scope', '$http',
              function($scope, $http) {
                console.log('Construct Dialog controller function item:', item);
                $scope.item = item;
                $scope.form = {genome: item.path};
            
                $scope.reconstruct = function(){
                    var newName = $scope.form.output_file;
                    var modelfolder = newName ? newName : item.name; 

                    self.showToast('Reconstructing', item.name, 5000);
                    MS.reconstruct($scope.form, {gapfill: 0, plant: 1, output_file: modelfolder})
                      .then(function(r) {
                           if (cb) cb(r);
                           self.showComplete('Reconstruct Complete', item.name, r[2]+r[0])
                      }).catch(function(e) {
                          self.showError('Reconstruct Error', e.error.message.slice(0,30)+'...')
                      })

                    $dialog.hide();
                };

                $scope.cancel = function(){
                    $dialog.hide();
                };
              }]
        })
    }

    /**
     * [function runFBA]
     * @param  {[type]}   ev   [$event object]
     * @param  {[type]}   item [describes model fba is being ran on]
     * @param  {Function} cb   [callback function for when operation is complete]
     * @return {[type]}        [undefined]
     */
    this.runFBA = function(ev, item, cb) {
        ev.stopPropagation();
        $dialog.show({
            templateUrl: 'app/views/dialogs/runFBA.html',
            targetEvent: ev,
            clickOutsideToClose: true,
            controller: ['$scope', '$http',
            function($scope, $http) {
                //$scope.isPlant = item.path.split('/')[2] === 'plantseed' ? true : false;
                $scope.form = {model: item.path, media_supplement: []};

                $scope.runFBA = function(){
                    self.showToast('Running Flux Balance Analysis', item.name, 5000)
                    MS.runFBA($scope.form)
                      .then(function(res) {
                          console.log('fba job started: ', res)
                          /* self.showComplete('FBA Complete',
                                       res.id+' '+res.media_ref.split('/').pop()) */
                          if (cb) cb();
                      }).catch(function(e) {
                          self.showError('Run FBA Error', e.error.message.slice(0,30)+'...')
                      })
                    $dialog.hide();
                }

                $scope.cancel = function(){
                    $dialog.hide();
                }

            }]
        })
    }

    this.runPlantFBA = function(ev, item, isPlant, cb) {
        ev.stopPropagation();
        $dialog.show({
            templateUrl: 'app/views/dialogs/fba-plant.html',
            targetEvent: ev,
            clickOutsideToClose: true,
            controller: ['$scope', '$http',
            function($scope, $http) {
                $scope.item = item;
                $scope.isPlant = isPlant;
                $scope.form = {
                    model: item.path, 
                    media_supplement: []
                };

                $scope.runFBA = function(){
                    // use default media if none
                    if (isPlant) {
                        $scope.form.media = $scope.form.media ? $scope.form.media :
                            "/chenry/public/modelsupport/media/PlantHeterotrophicMedia";
                    }
                    else {
                        $scope.form.media = $scope.form.media ? $scope.form.media : "Complete";
                    }
                    MS.runFBA($scope.form)
                      .then(function(res) {
                          console.log('fba job started: ', res)
                          self.showToast('Running Flux Balance Analysis ', item.path.split('/').pop(), 5000);
                          if (cb) cb();
                          // self.showComplete('FBA Complete', res.id)
                      }).catch(function(e) {
                          self.showError('Run FBA Error', e.error.message.slice(0,30)+'...')
                      })
                    $dialog.hide();
                }

                $scope.cancel = function(){
                    $dialog.hide();
                }

            }]
        })
    }    

    this.gapfill = function(ev, item, cb) {
        ev.stopPropagation();
        $dialog.show({
            templateUrl: 'app/views/dialogs/gapfill.html',
            targetEvent: ev,
            clickOutsideToClose: true,
            controller: ['$scope', '$http',
            function($scope, $http) {
                $scope.isPlant = item.path.split('/')[2] === 'plantseed' ? true : false;
                $scope.form = {model: item.path};

                $scope.gapfill = function(){
                    // use default media if none
                    if ($scope.isPlant) {
                        $scope.form.media = $scope.form.media ? $scope.form.media :
                            "/chenry/public/modelsupport/media/PlantHeterotrophicMedia";
                    }
                    else {
                        $scope.form.media = $scope.form.media ? $scope.form.media : "Complete";
                    }
                    MS.gapfill($scope.form)
                      .then(function(res) {
                          self.showToast('Running gapfilling...', item.path.split('/').pop(), 5000);
                          console.log('gapfill job started: ', res)
                          if (cb) cb();
                      }).catch(function(e) {
                          self.showError('Gapfill Error', e.error.message.slice(0,30)+'...')
                      })
                    $dialog.hide();
                }

                $scope.cancel = function(){
                    $dialog.hide();
                }

            }]
        })
    }

    this.saveAs = function(ev, saveCB, cancelCB, subtext) {
        if (ev) ev.stopPropagation();
        return $dialog.show({
            templateUrl: 'app/views/dialogs/save-as.html',
            targetEvent: ev || null,
            clickOutsideToClose: true,
            controller: ['$scope', '$http',
            function($scope, $http) {
                $scope.subtext = subtext

                $scope.save = function(name){
                    saveCB(name);
                    $dialog.hide();
                }

                $scope.cancel = function($event){
                    console.log('calling cancel')
                    $event.preventDefault();
                    if (cancelCB) cancelCB();
                    $dialog.hide();
                }
            }]
        })
    }

    this.error = function(title, msg) {
        return $dialog.show({
            templateUrl: 'app/views/dialogs/error-prompt.html',
            clickOutsideToClose: true,
            controller: ['$scope', '$http',
            function($s, $http) {
                $s.title = title;
                $s.msg = msg;

                $s.ok = function(){
                    $dialog.hide();
                }

                $s.cancel = function(){
                    $dialog.hide();
                }
            }]
        })
    }

    this.showToast = function(title, name, duration) {
      $mdToast.show({
        controller: 'ToastCtrl',
        parent: angular.element('.sidebar'),
        //templateUrl:'app/views/dialogs/notify.html',
        template: '<md-toast>'+
                      '<span flex style="margin-right: 30px;">'+
                         '<span class="ms-color">'+title+'</span><br>'+
                         (name ? name.slice(0,20)+'...' : '')+'</span>'+
                      '<!--<md-button offset="33" ng-click="closeToast()">'+
                        'Hide'+
                      '</md-button>-->'+
                    '</md-toast>',
        hideDelay: duration,
      });
    };

    this.showComplete = function(title, name, path) {
        $mdToast.show({
         controller: 'ToastCtrl',
         parent: angular.element('.sidebar'),
         //templateUrl:'app/views/dialogs/notify.html',
         template: '<md-toast>'+
                     '<span flex style="margin-right: 30px; width: 200px;">'+
                       '<span class="ms-color-complete">'+title+'</span>'+
                       (name ?
                          '<br>'+(name.length > 19 ? name.slice(0,20) +'...' : name)
                          : '')+
                      '</span>'+
                      (path ?
                          '<md-button offset="33" ng-click="closeToast()" ui-sref="app.modelPage({path:\''+path +'\'})">'+
                          'View'+
                          '</md-button>' : '')+
                 '</md-toast>',
         hideDelay: 10000
       });
    }

    this.download = function(ev, cols, tbody, filename) {
        ev.stopPropagation();
        return $dialog.show({
            templateUrl: 'app/views/dialogs/download.html',
            targetEvent: ev,
            clickOutsideToClose: true,
            controller: ['$scope', '$http',
            function($scope, $http) {
                var csvData = uiTools.JSONToCSV(cols, tbody);
                var tabData = uiTools.JSONToTabTable(cols, tbody);

                $scope.filename = filename;

                $timeout(function () {
                    document.getElementById('download-csv')
                            .setAttribute("href", "data:text/csv;charset=utf-8,"+encodeURI(csvData));

                    document.getElementById('download-tab')
                            .setAttribute("href", "data:text/plain;charset=utf-8,"+encodeURI(tabData));

                })

                $scope.cancel = function($event){
                    $event.preventDefault();
                    $dialog.hide();
                }
            }]
        })
    }

    this.solrDownload = function(ev, core, csvUrl) {
        ev.stopPropagation();
        return $dialog.show({
            templateUrl: 'app/views/dialogs/solr-download.html',
            targetEvent: ev,
            clickOutsideToClose: true,
            controller: ['$scope', '$http',
            function($scope, $http) {
                $scope.csvUrl = csvUrl;
                $scope.filename = core+'.csv';

                $scope.cancel = function($event){
                    $event.preventDefault();
                    $dialog.hide();
                }
            }]
        })
    }

    this.uploadExpression = function(ev, item, cb) {
        ev.stopPropagation();        
        $dialog.show({
            targetEvent: ev,
            clickOutsideToClose: true,            
            templateUrl: 'app/views/dialogs/upload-expression.html',
            controller: ['$scope', function($scope) {
                var $this = $scope;

                console.log('ITEM!', item)

                // user inputed name and whatever
                $this.form = {};
                $this.selectedFiles; // file objects

                $scope.selectFile = function(files) {
                    // no ng binding suppose for file inputs
                    $scope.$apply(function() {
                        $this.selectedFiles = files;
                    })
                }

                $scope.startUpload = function() {
                	var name = "";
                	if( ! item.name ) {
                		var name = item.path.split('/').slice( -1 )[ 0 ]; 
                	} else {
                		var name = item.name;
                	}
                    startUpload( name );
                }

                function startUpload(name) {
                    $dialog.hide();
                    self.showToast('Importing expression data', 
                        'please be patient', 10000000)

                    Upload.uploadFile($this.selectedFiles, null, function(node) {                        
                        MS.createExpressionFromShock(node, name, $scope.form.name)
                            .then(function(res) {
                                console.log('done importing', res)
                                self.showComplete('Import complete', name);
                                if (cb) cb();
                            }).catch(function(e) {
                                self.showError('something has gone wrong')
                                console.error(e.error.message)                                
                            })
                    }, function(error) {
                        console.log('shock error:', error)
                        self.showError('Upload to SHOCK failed (see console)')                        
                    })                    
                }     

                $scope.cancel = function() {
                    $dialog.hide();
                }
            }]
        })    
    }

   this.annotatePlant = function(ev, item, cb) {
        ev.stopPropagation();
        $dialog.show({
            templateUrl: 'app/views/dialogs/annotate-plant.html',
            targetEvent: ev,
            clickOutsideToClose: true,
            preserveScope: true,
            controller: ['$scope', '$http',
            function($scope, $http) {
                $scope.form = {
                    kmers: false,
                    blast: false
                };

                $scope.annotate = function(){
                    self.showToast('Annotating', item.name, 5000)

                    console.log('anno form:', $scope.form)
        
                    var path = item.path.split('/').slice(0, -2).join('/')
                    $scope.form.name = item.name
                    MS.annotatePlant($scope.form)
                      .then(function(res) {
                           if (cb) cb();
                           // fixme: add name
                           self.showComplete('Annotation Complete')
                      }).catch(function(e) {
                          self.showError('Annotation Error', e.error.message.slice(0,30)+'...')
                      })
                    $dialog.hide();
                }

                $scope.cancel = function(){
                    $dialog.hide();
                }
            }]
        })
    }    

    this.leaveComment = function(ev, rowId, item_list, userinfo, cb) {
        ev.stopPropagation();
        $dialog.show({
            templateUrl: 'app/views/dialogs/leaveComment.html',
            targetEvent: ev,
            clickOutsideToClose: true,
            controller: ['$scope', '$http',
              function($scope, $http) {
                if( item_list == undefined || item_list.length == 0) {
                    item_list = ['incorrect abbreviation', 'incorrect database mapping'];
                }
                $scope.items = item_list;
                $scope.selected = [];
                $scope.row_id = rowId;
                if (userinfo == undefined) {
                    userinfo = {username: Auth.user};
                }
                else{
                    console.log('Commenting from user: ', userinfo);
                }
                $scope.user = userinfo;

                $scope.submit = function() {
                    if ($scope.selected.length != 0 || $scope.user['remarks']) {
                        var ms_rest_endpoint = config.services.ms_rest_url+'comments';
                        var comments = {user: $scope.user,
                            rowId: $scope.row_id,
                            comments: $scope.selected};
                        var data = {comment: JSON.stringify(comments)};
                        /* use $http to post the comments JSON object to the ms_rest_url endpoint
                        var comm_headers = {
                                Authentication: Auth.token,
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        console.log('headers', comm_headers);
                        var req = $http({
                            method: 'POST',
                            url: ms_rest_endpoint,
                            headers: comm_headers,
                            data: data
                        });
                        req.then( onSuccess, onError );
                        */
                        $.ajax({
                            url: ms_rest_endpoint,
                            dataType: 'json',
                            type: 'POST',
                            data: data,
                            success: function(response){
                                console.log( "Successfully POST-ed data:\n", comments);
                                swal('User comments', response.msg);
                            },
                            error: function(response) {
                                if(response.msg) {
                                    console.log("POST-ing of data failed:\n", comments);
                                    swal('User comments', response.msg);
                                }
                                else {
                                    var cm_msg = "POST-ing of data failed with unknown error.";
                                    console.log(cm_msg + "\n", comments);
                                    swal('User comments', cm_msg);
                                }
                            }
                        });
                        cb(comments);
                    }
                    $dialog.hide();
                }

                $scope.cancel = function(){
                    $dialog.hide();
                }

                $scope.toggle = function (item, list) {
                  var idx = list.indexOf(item);
                  if (idx > -1) {
                    list.splice(idx, 1);
                  }
                  else {
                    list.push(item);
                  }
                }
                $scope.exists = function (item, list) {
                  return list.indexOf(item) > -1;
                }
            }]
        })
    }
}])

.service('AuthDialog',
['$rootScope', '$mdDialog', '$window', '$timeout', 'Auth', '$stateParams',
function($rootScope, $dialog, $window, $timeout, Auth, $stateParams) {

    this.signIn = function() {
        return $dialog.show({
            templateUrl: 'app/views/dialogs/auth.html',
            clickOutsideToClose: false,
            controller: ['$scope', '$state', '$http',
            function($s, $state, $http) {
                // set login method
                if ($rootScope.$stateParams.login == 'patric')
                    $s.method = Auth.loginMethod('patric');
                else
                    $s.method = Auth.loginMethod('rast');

                $s.creds = {};

                // sets method and changes url param
                $s.switchMethod = function(method) {
                    $s.method = Auth.loginMethod(method);
                    $stateParams.login = method;
                    $s.inValid = false;
                }

                $s.ok = function(){
                    $s.loading = true;

                    if ($stateParams.login == 'patric')
                        var prom = Auth.loginPatric($s.creds.user, $s.creds.pass)
                    else
                        var prom = Auth.login($s.creds.user, $s.creds.pass)

                    prom.success(function(data) {
                        $dialog.hide();
                        $state.transitionTo($state.current.name, {}, {reload: true, inherit: true, notify: false})
                            .then(function() {
                                setTimeout(function(){
                                    $window.location.reload();
                                }, 0);
                            });

                    }).error(function(e, status){
                        $s.loading = false;
                        if (status == 401)
                            $s.inValid = true;
                        else
                            $s.failMsg = "Could not reach authentication service: "+e.error_msg;
                    })
                }

                $s.cancel = function(){
                    $dialog.hide();
                }
            }]
        })
    }
}])

.service('FBDialog',
['$mdDialog', 'Auth', 'config', function($dialog, Auth, config) {

    this.leaveFeedback = function() {
        return $dialog.show({
            templateUrl: 'app/views/dialogs/user_feedback.html',
            clickOutsideToClose: true,
            controller: ['$scope', '$http',
              function($scope, $http) {
                $scope.user = {'username': Auth.user,
                               'name': '',
                               'email': ''};
                $scope.remarks = '';
                console.log('Feedback from user: ', $scope.user.username);

                $scope.submit = function() {
                    if ($scope.remarks && $scope.remarks.toLowerCase() != 'feedback') {
                        var ms_rest_endpoint = config.services.ms_rest_url+'feedback';
                        var comments = {user: $scope.user,
                                        comments: $scope.remarks};
                        var data = {comment: JSON.stringify(comments)};
                        $.ajax({
                            url: ms_rest_endpoint,
                            dataType: 'json',
                            type: 'POST',
                            data: data,
                            success: function(response){
                                console.log( "Successfully POST-ed data:\n", comments);
                                swal('User feedback', response.msg);
                            },
                            error: function(response) {
                                if(response.msg) {
                                    console.log("POST-ing of data failed:\n", comments);
                                    swal('User feedback', response.msg);
                                }
                                else {
                                    var cm_msg = "POST-ing of data failed with unknown error.";
                                    console.log(cm_msg + "\n", comments);
                                    swal('User feedback', cm_msg);
                                }
                            }
                        });
                    }
                    $dialog.hide();
                }

                $scope.cancel = function(){
                    $dialog.hide();
                }
            }]
        })
    }
}])

.controller('ToastCtrl', ['$scope', '$mdToast', '$timeout', function($scope, $mdToast, $timeout) {
  $scope.closeToast = function() {
    $mdToast.hide();
  };
}])

.controller('AppCtrl', ['$scope', '$mdToast', '$timeout',
function($scope, $mdToast, $timeout) {
  $scope.closeToast = function() {
    $mdToast.hide();
  };
}])
