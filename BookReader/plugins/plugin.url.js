"use strict";(self.webpackChunk_internetarchive_bookreader=self.webpackChunk_internetarchive_bookreader||[]).push([[336],{8837:function(t,o,e){var a;e(5827),e(4916),e(5306),e(2222),e(6992),e(1539),e(8783),e(3948),e(285),e(3609).extend(BookReader.defaultOptions,{enableUrlPlugin:!0,bookId:"",defaults:null,updateWindowTitle:!1,urlMode:"hash",urlHistoryBasePath:"/",urlTrackedParams:["page","search","mode","region","highlight"],urlTrackIndex0:!1}),BookReader.prototype.setup=(a=BookReader.prototype.setup,function(t){a.call(this,t),this.bookId=t.bookId,this.defaults=t.defaults,this.locationPollId=null,this.oldLocationHash=null,this.oldUserHash=null}),BookReader.prototype.init=function(t){return function(){var o=this;this.options.enableUrlPlugin&&(this.bind(BookReader.eventNames.PostInit,(function(){var t=o.options,e=t.updateWindowTitle,a=t.urlMode;e&&(document.title=o.shortTitle(50)),"hash"===a&&o.urlStartLocationPolling()})),this.bind(BookReader.eventNames.fragmentChange,this.urlUpdateFragment.bind(this))),t.call(this)}}(BookReader.prototype.init),BookReader.prototype.shortTitle=function(t){return this.bookTitle.length<t?this.bookTitle:"".concat(this.bookTitle.substr(0,t-3),"...")},BookReader.prototype.urlStartLocationPolling=function(){var t=this;this.oldLocationHash=this.urlReadFragment(),this.locationPollId&&(clearInterval(this.locationPollID),this.locationPollId=null),this.locationPollId=setInterval((function(){var o=t.urlReadFragment();if(o!=t.oldLocationHash&&o!=t.oldUserHash){var e=t.paramsFromFragment(o),a=function(){return t.updateFromParams(e)};t.trigger(BookReader.eventNames.stop),t.animating?(t.autoStop&&t.autoStop(),t.animationFinishedCallback=a):a(),t.oldUserHash=o}}),500)},BookReader.prototype.urlUpdateFragment=function(){var t=this.paramsFromCurrent(),o=this.options,e=o.urlMode,a=o.urlTrackIndex0,r=o.urlTrackedParams;a||void 0===t.index||0!==t.index||(delete t.index,delete t.page);var n=r.reduce((function(o,e){return e in t&&(o[e]=t[e]),o}),{}),i=this.fragmentFromParams(n,e),s=this.urlReadFragment(),l=this.getLocationSearch(),h=this.queryStringFromParams(n,l,e);if(s!==i||l!==h)if("history"===e){if(window.history&&window.history.replaceState){var d=this.options.urlHistoryBasePath.replace(/\/+$/,""),u=""===i?"":"/".concat(i),c="".concat(d).concat(u).concat(h);window.history.replaceState({},null,c),this.oldLocationHash=i+h}}else{var p=this.urlParamsFiltersOnlySearch(this.readQueryString());window.location.replace("#"+i+p),this.oldLocationHash=i+p}},BookReader.prototype.urlParamsFiltersOnlySearch=function(t){var o=new URLSearchParams(t);return o.has("q")?"?".concat(new URLSearchParams({q:o.get("q")})):""},BookReader.prototype.urlReadFragment=function(){var t=this.options,o=t.urlMode,e=t.urlHistoryBasePath;return"history"===o?window.location.pathname.substr(e.length):window.location.hash.substr(1)},BookReader.prototype.urlReadHashFragment=function(){return window.location.hash.substr(1)}}},function(t){t(t.s=8837)}]);
//# sourceMappingURL=plugin.url.js.map