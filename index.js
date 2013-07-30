var natural = require('natural'),
    andStream = require('and-stream');

module.exports = fulltextEngine;
function fulltextEngine() {
  return {
    query: query,
    match: match,
    plans: {
      'fulltext': fulltextPlan,
    }
  };
}

function keyfn(index) {
  return index.key[index.key.length - 1];
}

function fulltextPlan(idx, metaPhones) {
  var db = this;
  var and = andStream(keyfn);
  metaPhones.forEach(function (metaPhone) {
    idx.createIndexStream({
      start: [metaPhone, null],
      end: [metaPhone, undefined]
    })
    .pipe(and.stream());
  });
  return and;
}

function query(prop, q) {
  var db = this;
  var path = prop.split('.');
  var tokens = tokenizeWords(q);
  var idx = db.indexes[prop];
  if (idx && idx.type in db.query.engine.plans) {
    return db.query.engine.plans[idx.type].call(db, idx, tokens);
  } else {
    return null;
  }
}

function tokenizeWords(text) {
  var _words = stem(stripStopWords(words(text)));
  var map = metaphoneMap(_words);
  return Object.keys(map).map(
    function (word) {
      return map[word];
    });
}

function match(prop, q, obj) {
  var path = prop.split('.');

  var needles = tokenizeWords(q);
  var haystack = tokenizeWords(fetchProp(obj, path));
  return needles.reduce(
    function (acc, needle) {
      return acc && ~haystack.indexOf(needle);
    }, true);
}

function fetchProp(obj, path) {
  while (path.length > 0) {
    var prop = path.shift();
    if (obj[prop] !== undefined) {
      obj = obj[prop];
    } else {
      return;
    }
  }
  return obj;
}

module.exports.index = index;
function index(prop) {
  return function (key, value, emit) {
    var val;
    if (value && prop && (val = fetchProp(value, prop.split('.'))) !== undefined) {
      tokenizeWords(val).forEach(emit);
    }
  };
}

module.exports.words = words;
function words (str){
  return String(str).match(/\w+/g);
}

module.exports.stem = stem;
function stem (words) {
  var ret = [];
  for (var i = 0, len = words.length; i < len; ++i) {
    ret.push(natural.PorterStemmer.stem(words[i]));
  }
  return ret;
}

module.exports.stripStopWords = stripStopWords;
function stripStopWords(words) {
  var ret = [];
  if (words) {
    for (var i = 0, len = words.length; i < len; ++i) {
      if (~natural.stopwords.indexOf(words[i])) continue;
      ret.push(words[i]);
    }
  }
  return ret;
}

module.exports.countWords = countWords;
function countWords(words) {
  var obj = {};
  for (var i = 0, len = words.length; i < len; ++i) {
    obj[words[i]] = (obj[words[i]] || 0) + 1;
  }
  return obj;
}

module.exports.metaphoneMap = metaphoneMap;
function metaphoneMap(words){
  var obj = {};
  for (var i = 0, len = words.length; i < len; ++i) {
    obj[words[i]] = natural.Metaphone.process(words[i]);
  }
  return obj;
}

module.exports.metaphoneArray = metaphoneArray;
function metaphoneArray(words) {
  var arr = []
    , constant;
  for (var i = 0, len = words.length; i < len; ++i) {
    constant = natural.Metaphone.process(words[i]);
    if (!~arr.indexOf(constant)) arr.push(constant);
  }
  return arr;
}