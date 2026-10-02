mergeInto(LibraryManager.library, {
 HS_FocusState: function(available,active) {
  window.historyBoardFocusAvailable=!!available; window.historyBoardFocusActive=!!active;
  var canvas=document.getElementById('unity-canvas');
  if(canvas) {
   canvas.style.touchAction=active?'none':'';
   if(!canvas.__historyFocusTouch) {
    canvas.__historyFocusTouch=true;
    var finger=null;
    var mouse=function(type,touch,down){canvas.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,clientX:touch.clientX,clientY:touch.clientY,button:0,buttons:down?1:0,detail:1,view:window}));};
    var touch=function(event){
     if(!window.historyBoardFocusActive&&finger===null){var t=event.changedTouches[0],r=canvas.getBoundingClientRect();var scale=Math.min(r.width/1200,r.height/900),x=t?(t.clientX-r.left-(r.width-1200*scale)/2)/scale:0,y=t?(t.clientY-r.top-(r.height-900*scale)/2)/scale:0;if(!window.historyBoardFocusAvailable||!t||x<980||x>1170||y<70||y>112)return;}
     if(event.type==='touchstart'&&finger===null&&event.touches.length===1){finger=event.changedTouches[0].identifier;mouse('mousedown',event.changedTouches[0],true);}
     else if(finger!==null){
      var current=Array.from(event.changedTouches).find(function(t){return t.identifier===finger;});
      if(current){if(event.type==='touchmove')mouse('mousemove',current,true);else if(event.type==='touchend'||event.type==='touchcancel'){mouse('mouseup',current,false);finger=null;}}
     }
     event.preventDefault();event.stopImmediatePropagation();
    };
    ['touchstart','touchmove','touchend','touchcancel'].forEach(function(name){canvas.addEventListener(name,touch,{capture:true,passive:false});});
   }
  }
 },
	HS_ClearMatchViews: function () {
		if (window.historyCloseMatchLog)
			window.historyCloseMatchLog();
	},
	HS_OpenMatchLog: function (matchId) {
		if (window.historyOpenMatchLog)
			window.historyOpenMatchLog(UTF8ToString(matchId));
	},
	HS_LoadTeacherGrant: function () {
		return stringToNewUTF8(localStorage.getItem('history.teacher.unlocked') || '');
	},
	HS_SaveTeacherGrant: function (verifierId) {
		localStorage.setItem('history.teacher.unlocked', UTF8ToString(verifierId));
	},
	HS_EntryRole: function () {
		return document.body.dataset.entry === 'teacher' ? 1 : document.body.dataset.entry === 'student' ? 2 : 0;
	},
	HS_TeacherUnlocked: function () {
		if (window.historyTeacherUnlocked)
			window.historyTeacherUnlocked();
	},
	HS_ReadableSeconds: function () {
		var state = Module.__historyReadable;
		if (!state) {
			state = Module.__historyReadable = {
				last: performance.now(), eligible: false
			};
			var reset = function () {
				state.eligible = false;
				state.last = performance.now();
			};
			document.addEventListener('visibilitychange', reset);
			window.addEventListener('blur', reset);
			window.addEventListener('focus', reset);
		}
		var now = performance.now(), visible = !document.hidden && document.hasFocus(), delta = (now - state.last) / 1000;
		var result = visible && state.eligible ? Math.max(0, delta) : 0;
		state.last = now;
		state.eligible = visible;
		return result;
	},
	HS_IsReadable: function () {
		return !document.hidden && document.hasFocus() ? 1 : 0;
	},
	HS_SetPointer: function (hand) {
		var canvas = Module.canvas;
		if (!canvas)
			return;
		canvas.style.cursor = hand ? 'pointer' : 'default';
		if (!canvas.__historyCursorLeave) {
			canvas.__historyCursorLeave = true;
			canvas.addEventListener('pointerleave', function () {
				canvas.style.cursor = 'default';
			});
		}
	},
	HS_LoadTips: function (player, match) {
		return stringToNewUTF8(sessionStorage.getItem('history.tips.' + UTF8ToString(player) + '.' + UTF8ToString(match)) || '');
	},
	HS_SaveTips: function (player, match, saved) {
		sessionStorage.setItem('history.tips.' + UTF8ToString(player) + '.' + UTF8ToString(match), UTF8ToString(saved));
	},
	HS_LoadToken: function () {
		return stringToNewUTF8(sessionStorage.getItem('studentToken') || '');
	},
	HS_SaveToken: function (token) {
		sessionStorage.setItem('studentToken', UTF8ToString(token));
	},
	HS_LoadSelectionTurn: function (player, match) {
		return stringToNewUTF8(sessionStorage.getItem('history.selectionTurn.' + UTF8ToString(player) + '.' + UTF8ToString(match)) || '');
	},
	HS_SaveSelectionTurn: function (player, match, sequence) {
		sessionStorage.setItem('history.selectionTurn.' + UTF8ToString(player) + '.' + UTF8ToString(match), UTF8ToString(sequence));
	},
	HS_LoadDismissed: function (player) {
		return stringToNewUTF8(sessionStorage.getItem('history.dismissed.' + UTF8ToString(player)) || '');
	},
	HS_SaveDismissed: function (player, match) {
		sessionStorage.setItem('history.dismissed.' + UTF8ToString(player), UTF8ToString(match));
	},
	HS_Presence: function (snapshot) {
		if (window.historyPresenceStatus) {
			window.unityInstance.SendMessage("HistoryGame", "PresenceStatus", window.historyPresenceStatus());
			return;
		}
		var data = JSON.parse(UTF8ToString(snapshot));
		import('/playroom.mjs').then(function (m) {
			return m.syncUnityPresence(data, function (s) {
				if (window.unityInstance)
					window.unityInstance.SendMessage('HistoryGame', 'PresenceStatus', s);
			});
		}).catch(function () {
			if (window.unityInstance)
				window.unityInstance.SendMessage('HistoryGame', 'PresenceStatus', 'Playroom unavailable. Local classroom controls remain active. Reload to reconnect.');
		});
	}
});
