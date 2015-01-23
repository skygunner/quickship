Namespace = function (_path, _root) {
    var ns = null;
    var _leaf = _root || window;
    _path = _path.split('.');

    for (var i = 0; i < _path.length; i++) {
        if (typeof _leaf[_path[i]] == "undefined") {
            _leaf[_path[i]] = {};
        }
        _leaf = _leaf[_path[i]];
    }
    return _leaf;
};