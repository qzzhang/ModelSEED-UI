

angular.module('WS', [])
.service('WS', ['$http', '$q', '$cacheFactory', '$log', 'config', 'Auth',
function($http, $q, $cacheFactory, $log, config, Auth) {
    "use strict";

    var self = this;
    var cache = $cacheFactory('ws');

    this.workspaces = [];

    this.list = function(path, opts) {
        var params = {paths: typeof path === 'string' ? [path] : path };
        angular.extend(params, opts);

        return $http.rpc('ws', 'ls', params)
                    .then(function(d) {
                        $log.log('data', d)
                        var d = d[path];

                        // parse into list of dicts
                        var data = [];
                        for (var i in d)
                            data.push( self.wsListToDict(d[i]) );

                        return data;
                    })
    }

    this.listL = function(path, opts) {
        var params = {paths: typeof path === 'string' ? [path] : path };
        angular.extend(params, opts);

        return $http.rpc('ws', 'ls', params)
                    .then(function(d) {
                        if (typeof path === 'string') return d[path];
                        return d;
                    })
    }


    // wsListToDict: takes workspace info array, returns dict.
    this.wsListToDict = function(ws) {
        return {name: ws[0],
                type: ws[1],
                path: ws[2],
                modDate: ws[3],
                id: ws[4],
                owner: ws[5],
                size: ws[6],
                files: null, // need
                folders: null, // need
                timestamp: Date.parse(ws[3])
               };
    }

    this.getObjectMeta = function(path) {
        $log.log('retrieving meta', path)
        return $http.rpc('ws', 'get', {objects: [path], metadata_only: 1})
                    .then(function(res) {
                        return res[0];
                    })
    }

    this.get = function(path) {
        $log.log('get (object)', path)
        return $http.rpc('ws', 'get', {objects: [path]})
                    .then(function(res) {
                        $log.log('get (object) response', res)

                        // if shock node, fetch. Otherwise, return data.
                        if (res[0][0][11].length > 0) {
                            $log.log('getting data from shock', Auth.token)
                            var url = res[0][0][11]+'?download',
                                header = {headers: {Authorization: 'OAuth '+Auth.token}};

                            return $http.get(url, header)
                                        .then(function(res) {
                                            return res.data;
                                        })
                        } else {
                            return {meta: res[0][0], data: JSON.parse(res[0][1])};
                        }
                    })
    }

    this.addToModel = function(ws) {
        self.workspaces.push( self.wsListToDict(ws) );
    }


    this.rmFromModel = function(ws) {
        for (var i=0; i<self.workspaces.length; i++) {
            if (self.workspaces[i].id == ws[4])
                self.workspaces.splice(i, 1);
        }
    }

    // takes source and destimation paths, moves object
    this.mv = function(src, dest) {
        var params = {objects: [[src, dest]], move: 1 };
        return $http.rpc('ws', 'copy', params)
                    .then(function(res) {
                        return res;
                    }).catch(function(e) {
                        console.error('could not mv', e)
                    })
    }

    // takes path of object, deletes object
    this.deleteObj = function(path, isFolder) {
        $log.log('calling delete')
        var params = {objects: [path],
                      deleteDirectories: isFolder ? 1 : 0,
                      force: isFolder ? 1 : 0};
        return $http.rpc('ws', 'delete', params)
                    .then(function(res) {
                        $log.log('deleted object', res)
                        return res;
                    }).catch(function(e) {
                        $log.error('delete failed', e, path)
                    })

    }


    this.getModel = function(ws, name) {
        return self.getObject(ws, name)
                   .then(function(data) {
                        var kbModeling = new KBModeling();
                        var obj = new kbModeling['KBaseFBA_FBAModel'](self);
                        obj.setData(data);
                        return obj;
                   })
    }

    this.getPublic = function() {
        return $http.get('data/app/modelList.json', {cache:true})
                    .then(function(res) {
                        console.log('data fetched', res)
                        var models = [];
                        for (var i=0; i<res.data.length; i++) {
                            var d = res.data[i];
                            models.push({orgName: d[10]['Name'],
                                         name: d[1],
                                         ws: d[7],
                                         rxnCount: d[10]['Number reactions'],
                                         cpdCount: d[10]['Number compounds']
                                        })
                        }
                        return models;
                    })
    }

    // takes workspace spec hash, creates node.  fixme: cleanup
    this.createNode = function(p) {
        var objs = [[p.path, p.type, null, null]];
        var params = {objects:objs, createUploadNodes: 1};
        return $http.rpc('ws', 'create', params).then(function(res) {
                    console.log('response', res)
                    return res;
                })
    }


    this.getDownloadURL = function(path) {
        return $http.rpc('ws', 'get_download_url', {objects:[path]})
                    .then(function(res) {
                        $log.log('download response', res)
                        return res;
                    })
    }
}])
