using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.Networking;

[Serializable]
public class PieceView
{
	public int side;
	public string rank;
}

[Serializable]
public class TargetView
{
	public int to;
	public bool attack;
}

[Serializable]
public class SelectionView
{
	public int from, side, seq;
	public TargetView[] targets;
}

[Serializable]
public class Dispatch
{
	public string text, kind, attacker, defender, moving;
	public int seq, from, to, side, outcome;
	public bool[] ack, released;
	public bool automatic;
	public TargetView[] targets;
}

[Serializable]
public class Commander
{
	public string id, name, fullName, role, summary, strategy, description, sourceTitle, sourceUrl;
	public int side;
}

[Serializable]
public class SetupView
{
	public bool enabled, started, automatic;
	public double remainingMs, serverNow, deadline, noticeRemainingMs;
	public int revision;
	public string[] draft;
}

[Serializable]
public class TurnClockView
{
	public bool enabled;
	public int side, seq;
	public double remainingMs, noticeRemainingMs, bannerRemainingMs, serverNow;
}

[Serializable]
public class BattleContinueView
{
	public bool supported, armed;
	public int seq;
	public double remainingMs;
}

[Serializable]
public class MatchView
{
	public string id, phase;
	public string[] playerNames;
	public Commander[] commanders;
	public int side, turn, seq, winner;
	public bool[] ready;
	public PieceView[] board;
	public Dispatch[] events;
	public SelectionView selection;
	public Dispatch battle;
	public bool blocked, setupBlocked;
	public TurnClockView turnClock;
	public BattleContinueView battleContinue;
	public SetupView setup;
}

[Serializable]
public class PresenceConfig
{
	public string gameId, roomCode, sessionId;
}

[Serializable]
public class PresenceSnapshot
{
	public string phase;
	public PresenceConfig presence;
}

[Serializable]
public class StudentView
{
	public string token, classCode, phase, player, nickname, error;
	public bool paired;
	public MatchView match;
	public Commander commander;
	public PresenceConfig presence;
}

[Serializable]
public class RosterEntry
{
	public string id, name;
	public int pair, side;
	public bool waiting, paired, connected;
}

[Serializable]
public class MatchSummary
{
	public string id, phase;
	public string[] players, playerNames;
	public int winner;
}

[Serializable]
public class SpectatorView
{
	public string classCode, phase, perspectiveName, error;
	public MatchView match;
	public PresenceConfig presence;
}

[Serializable]
public class TeacherView
{
	public string classCode, phase, error;
	public RosterEntry[] roster;
	public MatchSummary[] matches;
	public PresenceConfig presence;
}

[Serializable]
public class Command
{
	public string name, classCode, a, b, requestId, matchId, perspective;
	public string[] ranks;
	public int from, to, seq, side, revision;
	public bool automatic;
}

[Serializable]
public class Fact
{
	public string text, source, url, lesson;
}

[Serializable]
public class Facts
{
	public Fact[] items;
}

public class HistoryGame : MonoBehaviour
{
#if UNITY_WEBGL && !UNITY_EDITOR
	[DllImport("__Internal")]
	static extern string HS_LoadToken();
	[DllImport("__Internal")]
	static extern void HS_SaveToken(string token);
	[DllImport("__Internal")]
	static extern void HS_Presence(string snapshot);
	[DllImport("__Internal")]
	static extern string HS_LoadSelectionTurn(string player, string match);
	[DllImport("__Internal")]
	static extern void HS_SaveSelectionTurn(string player, string match, string sequence);
	[DllImport("__Internal")]
	static extern string HS_LoadDismissed(string player);
	[DllImport("__Internal")]
	static extern void HS_SaveDismissed(string player, string match);
#endif
#if UNITY_WEBGL && !UNITY_EDITOR
	[DllImport("__Internal")]
	static extern void HS_SetPointer(int hand);
	[DllImport("__Internal")]
	static extern float HS_ReadableSeconds();
	[DllImport("__Internal")]
	static extern int HS_IsReadable();
	[DllImport("__Internal")]
	static extern string HS_LoadTips(string player, string match);
	[DllImport("__Internal")]
	static extern void HS_SaveTips(string player, string match, string saved);
#endif
	bool pointerWanted, browserMode, teacherGateOpen, teacherGatePassed;
	string teacherEntryKey = "", teacherGateStatus = "";
	Commander openCommander;
	string openCommanderMatch = "";
	float setupReceivedAt;
	readonly Vector2[] introScroll = new Vector2[2];
	string token = "", teacherKey = "", code = "", error = "", swap = "", presence = "Playroom not connected";
	string baseUrl = "http://127.0.0.1:8080", lastMatch = "", dismissedMatch = "", dismissedPlayer = "", endgameLogged = "";
	StudentView state;
	TeacherView teacher;
	SpectatorView spectator;
	string watchId = "";
	Vector2 matchScroll;
	bool busy, teacherMode, commanderOpen;
	Vector2 commanderScroll;
	int selected = -1, factIndex;
	float nextPoll, nextFact = 20;
	string[] formation;
	Fact[] facts = Array.Empty<Fact>();
	Vector2 rosterScroll;
	readonly string[] ranks =
	{
		"F",
		"B",
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
		"7",
		"8",
		"9",
		"10"
	};
	readonly int[] counts =
	{
		1,
		6,
		1,
		8,
		5,
		4,
		4,
		4,
		3,
		2,
		1,
		1
	};
	readonly string[] names =
	{
		"Flag",
		"Bomb",
		"Spy",
		"Scout",
		"Miner",
		"Sgt",
		"Lt",
		"Captain",
		"Major",
		"Colonel",
		"General",
		"Marshal"
	};
	string apiStatus = "", actionStatus = "";
	float apiRecoveryUntil;
	Command pending;
	GUIStyle pieceStyle;
	Vector2 rawPointer;
	readonly TurnNotice turnNotice = new TurnNotice();
	readonly CombatClickGate combatClick = new CombatClickGate();
	readonly ReadableTiming revealTiming = new ReadableTiming(), reminderTiming = new ReadableTiming();
	string reminderKey;
	bool reminderVisible, reminderWasVisible;
	float readableSeconds;
	bool pageReadable;
	BattleTips battleTips;
	string tipKey = "", tipSaved = "";
	int shownTip;
	bool tipVisible;
	readonly CombatClickGate tipClick = new CombatClickGate();
	string paintedTip = "";
	float tipDismissUntil;
	Command pendingCombatAck, pendingManualSelect;
	int manualSelectionRequested = -1;
	float combatDismissUntil;
	readonly HashSet<string> dispatchStarted = new HashSet<string>();
	string autoSelectionMatch = "";
	int autoSelectionSeq = -1, autoSelectionIndex;
	int[] autoSelectionCandidates;
	float turnNoticeStart = -10;
	int sidebarTab;
	Vector2 instructionsScroll, dispatchScroll;
	[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
	static void Boot()
	{
		if (FindAnyObjectByType<HistoryGame>() == null)
			new GameObject("HistoryGame").AddComponent<HistoryGame>();
	}

	[Serializable]
	class BrowserLoginData
	{
		public string role, code, key;
	}

#if UNITY_WEBGL && !UNITY_EDITOR
	[DllImport("__Internal")]
	static extern void HS_TeacherUnlocked();
	[DllImport("__Internal")]
	static extern int HS_EntryRole();
	[DllImport("__Internal")]
	static extern string HS_LoadTeacherGrant();
	[DllImport("__Internal")]
	static extern void HS_SaveTeacherGrant(string verifierId);
	[DllImport("__Internal")]
	static extern void HS_OpenMatchLog(string matchId);
#endif
	public void OpenTeacherGate(string unused)
	{
		browserMode = true;
		teacherGateOpen = true;
		teacherGatePassed = false;
		teacherEntryKey = "";
		teacherGateStatus = "";
	}

	Texture2D brandLogo;
	void DrawBrandLogo(Rect area)
	{
		if (brandLogo == null)
			brandLogo = Resources.Load<Texture2D>("BrandLogo");
		if (brandLogo != null)
			GUI.DrawTexture(area, brandLogo, ScaleMode.ScaleToFit, true);
	}

	void DrawTeacherGate()
	{
		Color oldColor = GUI.color, oldBackground = GUI.backgroundColor, oldContent = GUI.contentColor;
		GUI.color = new Color(.063f, .106f, .129f);
		GUI.DrawTexture(new Rect(-2000, -2000, 6000, 6000), Texture2D.whiteTexture);
		GUI.color = new Color(.12f, .19f, .23f);
		GUI.DrawTexture(new Rect(240, 120, 720, 650), Texture2D.whiteTexture);
		GUI.color = new Color(.89f, .78f, .45f);
		GUI.DrawTexture(new Rect(240, 120, 720, 4), Texture2D.whiteTexture);
		GUI.color = Color.white;
		GUI.contentColor = new Color(.92f, .95f, .96f);
		var heading = new GUIStyle(GUI.skin.label)
		{
			fontSize = 30,
			fontStyle = FontStyle.Bold,
			wordWrap = true
		};
		DrawBrandLogo(new Rect(400, 155, 400, 200));
		var body = new GUIStyle(GUI.skin.label)
		{
			fontSize = 18,
			wordWrap = true
		};
		GUI.Label(new Rect(280, 375, 640, 55), "Teacher access\nEnter your key to open your classroom.", body);
		var field = new GUIStyle(GUI.skin.textField)
		{
			fontSize = 22,
			padding = new RectOffset(14, 14, 12, 10)
		};
		field.normal.background = Texture2D.whiteTexture;
		field.focused.background = Texture2D.whiteTexture;
		field.normal.textColor = Color.white;
		field.focused.textColor = Color.white;
		GUI.backgroundColor = new Color(.137f, .212f, .251f);
		teacherEntryKey = GUI.PasswordField(new Rect(280, 450, 640, 54), teacherEntryKey, '*', 200, field);
		var submit = new GUIStyle(GUI.skin.button)
		{
			fontSize = 19,
			fontStyle = FontStyle.Bold
		};
		submit.normal.background = Texture2D.whiteTexture;
		submit.hover.background = Texture2D.whiteTexture;
		submit.active.background = Texture2D.whiteTexture;
		submit.normal.textColor = new Color(.063f, .13f, .18f);
		submit.hover.textColor = submit.normal.textColor;
		submit.active.textColor = submit.normal.textColor;
		GUI.backgroundColor = new Color(.89f, .78f, .45f);
		if (GUI.Button(new Rect(280, 530, 640, 52), "Open teacher desk", submit))
		{
			if (TeacherGateVerifier.Accepts(teacherEntryKey))
			{
				teacherEntryKey = "";
				teacherGatePassed = true;
				teacherGateOpen = false;
#if UNITY_WEBGL && !UNITY_EDITOR
				HS_SaveTeacherGrant(TeacherGateVerifier.RememberedId());
				HS_TeacherUnlocked();
#endif
			}
			else
				teacherGateStatus = "That key was not accepted. Try again.";
		}

		GUI.contentColor = new Color(1f, .83f, .48f);
		GUI.Label(new Rect(280, 605, 640, 50), teacherGateStatus, body);
		GUI.contentColor = new Color(.70f, .77f, .80f);
		GUI.Label(new Rect(280, 700, 640, 45), "A successful unlock is remembered in this browser.", new GUIStyle(body) { fontSize = 15 });
		GUI.color = oldColor;
		GUI.backgroundColor = oldBackground;
		GUI.contentColor = oldContent;
	}

	public void BrowserLogin(string json)
	{
		browserMode = true;
		baseUrl = "https://classroom.invalid"; // Virtual endpoint handled by the Playroom browser adapter.
		var login = JsonUtility.FromJson<BrowserLoginData>(json);
		code = login.code;
		if (login.role == "teacher")
		{
			if (!teacherGatePassed)
			{
				OpenTeacherGate("");
				return;
			}

			teacherKey = login.key;
			Send("teacher/state", new Command());
		}
		else
			Send("join", new Command { classCode = code });
	}

	void Start()
	{
#if UNITY_WEBGL && !UNITY_EDITOR
		int entryRole = HS_EntryRole();
		browserMode = entryRole != 0;
		teacherGatePassed = entryRole == 1 && TeacherGateVerifier.AcceptsRemembered(HS_LoadTeacherGrant());
		teacherGateOpen = entryRole == 1 && !teacherGatePassed;
#endif
		Application.runInBackground = true;
		Application.targetFrameRate = 4;
		QualitySettings.vSyncCount = 0;
		UnityEngine.Rendering.OnDemandRendering.renderFrameInterval = 1;
		foreach (var camera in FindObjectsByType<Camera>())
			camera.cullingMask &= ~((1 << 30) | (1 << 29));
#if UNITY_WEBGL && !UNITY_EDITOR
		baseUrl = new Uri(Application.absoluteURL).GetLeftPart(UriPartial.Authority);
		token = HS_LoadToken();
#endif
		formation = ArmyFormation.Generate();
		StartCoroutine(LoadFacts());
#if UNITY_WEBGL && !UNITY_EDITOR
		if (teacherGatePassed)
			HS_TeacherUnlocked();
#endif
	}

	IEnumerator LoadFacts()
	{
		using (var r = UnityWebRequest.Get(baseUrl + "/facts.json"))
		{
			yield return r.SendWebRequest();
			if (r.result == UnityWebRequest.Result.Success)
				facts = JsonUtility.FromJson<Facts>("{\"items\":" + r.downloadHandler.text + "}").items;
		}
	}

	void Update()
	{
		if (pendingManualSelect != null && !busy)
		{
			var command = pendingManualSelect;
			pendingManualSelect = null;
			var match = teacherMode ? null : StudentMatch();
			if (match?.id == command.matchId && match.seq == command.seq && state.phase == "active" && match.phase == "play" && match.turn == match.side && !DeadlineBlocked(match) && !match.blocked && match.battle?.kind != "combat")
				Send("select", command);
			else
				manualSelectionRequested = -1;
		}

#if UNITY_WEBGL && !UNITY_EDITOR
		readableSeconds = HS_ReadableSeconds();
		pageReadable = HS_IsReadable() != 0;
#else
		pageReadable = Application.isFocused;
		readableSeconds = pageReadable ? Time.unscaledDeltaTime : 0;
#endif
		UpdateAutomaticContinue();
		if (pendingCombatAck != null && !busy)
		{
			var command = pendingCombatAck;
			pendingCombatAck = null;
			var match = teacherMode ? null : StudentMatch();
			if (match?.id == command.matchId && match.battle?.kind == "combat" && match.battle.seq == command.seq && !match.battle.ack[match.side])
				Send("ack", command);
		}

		var turnMatch = teacherMode ? null : StudentMatch();
		bool clear = apiStatus == "" && turnMatch != null && state.phase == "active" && turnMatch.phase == "play" && turnMatch.turn == turnMatch.side && !DeadlineBlocked(turnMatch) && !turnMatch.blocked && turnMatch.battle?.kind != "combat" && presentationMatch == turnMatch.id && receivedSeq >= turnMatch.seq && motion == null && motions.Count == 0 && Time.unscaledTime >= localBattleUntil;
		UpdateAutoSelection(turnMatch, clear);
		if (turnNotice.Observe(turnMatch?.id, turnMatch?.side ?? -1, turnMatch?.turn ?? -1, turnMatch?.phase, clear))
		{
			turnNoticeStart = Time.unscaledTime;
			boostUntil = Mathf.Max(boostUntil, turnNoticeStart + 2);
			if (Application.absoluteURL.Contains("qa=1"))
				Debug.Log("YOUR_TURN_NOTICE " + turnMatch.id + " " + turnMatch.turn);
		}

		if (!clear)
			turnNoticeStart = -10;
		UpdateTutorialTips(turnMatch);
		reminderKey = turnMatch == null ? null : turnMatch.id + ":" + turnMatch.seq;
		reminderTiming.Observe(reminderKey, clear && !commanderOpen && !tipVisible, readableSeconds);
		reminderVisible = clear && !commanderOpen && !tipVisible && (turnMatch?.turnClock?.enabled == true ? turnMatch.turnClock.bannerRemainingMs <= 0 && turnMatch.turnClock.remainingMs <= 15000 && turnMatch.turnClock.remainingMs > 12000 : reminderTiming.InWindow(15, 3));
		if (reminderVisible != reminderWasVisible && Application.absoluteURL.Contains("qa=1"))
			Debug.Log((reminderVisible ? "REMINDER_OPEN " : "REMINDER_CLOSE ") + reminderKey);
		reminderWasVisible = reminderVisible;
		bool boardVisible = teacherMode ? watchId != "" && spectator?.match != null : StudentMatch() != null && !NeedsIntro(StudentMatch());
		Application.targetFrameRate = Time.unscaledTime < boostUntil ? 24 : boardVisible && pageReadable ? 12 : 4;
		if (Time.unscaledTime > nextFact)
		{
			NextFact();
			nextFact = Time.unscaledTime + 20;
		}

		if (!busy && Time.unscaledTime > nextPoll && (teacherMode || token != ""))
		{
			nextPoll = Time.unscaledTime + 1;
			Send(teacherMode ? (watchId != "" ? "teacher/spectate" : "teacher/state") : "state", new Command { matchId = watchId });
		}
	}

	void Send(string route, Command command)
	{
		if (!busy)
			StartCoroutine(Request(route, command));
	}

	IEnumerator Request(string route, Command command)
	{
		bool routine = (route == "state" || route == "teacher/state" || route == "teacher/spectate") && string.IsNullOrEmpty(command.perspective);
		actionStatus = routine ? "" : "Sending action...";
		busy = true;
		using (var req = new UnityWebRequest(baseUrl + "/api/" + route, "POST"))
		{
			req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(JsonUtility.ToJson(command)));
			req.downloadHandler = new DownloadHandlerBuffer();
			req.SetRequestHeader("Content-Type", "application/json");
			req.SetRequestHeader("Authorization", "Bearer " + (route.StartsWith("teacher/") ? teacherKey : token));
			req.timeout = 12;
			yield return req.SendWebRequest();
			if (req.result != UnityWebRequest.Result.Success)
			{
				if (route == "ack")
				{
					combatClick.Retry();
					revealTiming.Retry();
				}

				if (req.result == UnityWebRequest.Result.ConnectionError || req.responseCode >= 500)
				{
					if (apiStatus == "")
						Debug.Log("CLASSROOM_CONNECTION offline");
					apiStatus = "Classroom connection unavailable - retrying. Displayed board may be stale.";
				}

				try
				{
					error = JsonUtility.FromJson<StudentView>(req.downloadHandler.text).error;
				}
				catch
				{
					error = req.error;
				}

				if (string.IsNullOrEmpty(error))
					error = req.error;
			}
			else if (route == "teacher/spectate")
			{
				spectator = JsonUtility.FromJson<SpectatorView>(req.downloadHandler.text);
				if (spectator.match?.board != null)
					for (int i = 0; i < spectator.match.board.Length; i++)
						if (string.IsNullOrEmpty(spectator.match.board[i]?.rank))
							spectator.match.board[i] = null;
				SyncPresence(spectator.phase, spectator.presence);
				error = "";
			}
			else if (route.StartsWith("teacher/"))
			{
				teacher = JsonUtility.FromJson<TeacherView>(req.downloadHandler.text);
				teacherMode = true;
				if (!routine)
					error = "";
				SyncPresence(teacher.phase, teacher.presence);
			}
			else
			{
				state = JsonUtility.FromJson<StudentView>(req.downloadHandler.text);
				if (state.match?.setup != null && !state.match.setup.enabled)
					state.match.setup = null;
				if (string.IsNullOrEmpty(state.commander?.id))
					state.commander = null;
				LoadDismissal();
				if (string.IsNullOrEmpty(state.match?.id))
					state.match = null;
				SyncPresence(state.phase, state.presence);
				setupReceivedAt = Time.unscaledTime;
				if (state.match?.board != null)
					for (int i = 0; i < state.match.board.Length; i++)
						if (string.IsNullOrEmpty(state.match.board[i]?.rank))
							state.match.board[i] = null;
				if (!string.IsNullOrEmpty(state.token))
				{
					token = state.token;
#if UNITY_WEBGL && !UNITY_EDITOR
					HS_SaveToken(token);
#endif
				}

				if (route == "move")
				{
					pending = null;
					selected = -1;
				}

				if (!routine)
					error = "";
				if (state.match != null && lastMatch != state.match.id)
				{
					lastMatch = state.match.id;
					selected = -1;
					pending = null;
					formation = ArmyFormation.Generate();
				}

				if (state.match?.setup?.draft?.Length == 40)
					formation = (string[])state.match.setup.draft.Clone();
				if (route.StartsWith("setup/"))
					selected = -1;
			}

			if (req.result == UnityWebRequest.Result.Success && apiStatus != "")
			{
				apiStatus = "";
				apiRecoveryUntil = Time.unscaledTime + 5;
				error = "";
				Debug.Log("CLASSROOM_CONNECTION restored");
			}
		}

		if (route == "select" && command.from == manualSelectionRequested && pendingManualSelect == null)
			manualSelectionRequested = -1;
		busy = false;
		actionStatus = "";
	}

	string PlayerName(MatchView m, int side)
	{
		string name = m.playerNames != null && m.playerNames.Length > side ? m.playerNames[side] : "Player";
		if (string.IsNullOrEmpty(name))
			name = "Player";
		if (name.Length > 18)
		{
			int cut = 17;
			if (char.IsHighSurrogate(name[cut - 1]))
				cut--;
			name = name.Substring(0, cut) + "...";
		}

		return name;
	}

	string SideName(MatchView m, int side)
	{
		return (side == 0 ? "RED - " : "BLUE - ") + PlayerName(m, side);
	}

	string Label(string r)
	{
		int i = Array.IndexOf(ranks, r);
		return i < 0 ? "?" : r + " " + names[i];
	}

	void NextFact()
	{
		if (facts.Length > 0)
			factIndex = (factIndex + 1) % facts.Length;
	}

	bool Button(float x, float y, float w, string text)
	{
		return GUI.Button(new Rect(x, y, w, 32), text);
	}

	void OnGUI()
	{
		GUI.matrix = Matrix4x4.identity;
		rawPointer = Event.current.mousePosition;
		float scale = Mathf.Min(Screen.width / 1200f, Screen.height / 900f);
		GUI.matrix = Matrix4x4.TRS(new Vector3((Screen.width - 1200f * scale) / 2f, (Screen.height - 900f * scale) / 2f, 0), Quaternion.identity, new Vector3(scale, scale, 1));
		var profileMatch = teacherMode ? (watchId != "" ? spectator?.match : null) : StudentMatch();
		pointerWanted = false;
		if (profileMatch?.id != openCommanderMatch || profileMatch?.battle?.kind == "combat" || profileMatch?.phase == "over" || (!teacherMode && state?.phase == "ended"))
			commanderOpen = false;
		if (DeadlineBlocked(profileMatch))
			commanderOpen = false;
		if (!HandleDeadlineInput(profileMatch))
		{
			if (!HandleTipInput())
				HandleCombatInput();
		}

		GUI.enabled = !commanderOpen;
		GUI.skin.label.fontSize = 16;
		GUI.skin.label.wordWrap = true;
		GUI.skin.label.richText = false;
		GUI.skin.button.richText = false;
		if (pieceStyle == null)
		{
			pieceStyle = new GUIStyle(GUI.skin.button)
			{
				fontSize = 12,
				wordWrap = true,
				alignment = TextAnchor.MiddleCenter,
				padding = new RectOffset(1, 1, 1, 1)
			};
			pieceStyle.normal.background = Texture2D.whiteTexture;
			pieceStyle.hover.background = Texture2D.whiteTexture;
			pieceStyle.active.background = Texture2D.whiteTexture;
			pieceStyle.normal.textColor = Color.white;
			pieceStyle.hover.textColor = Color.white;
			pieceStyle.active.textColor = Color.white;
		}

		GUI.skin.button.fontSize = 15;
		GUI.skin.textField.fontSize = 16;
		if (teacherGateOpen)
		{
			DrawTeacherGate();
			return;
		}

		GUI.Box(new Rect(10, 10, 1180, 880), "");
		bool compactMatchHeader = teacherMode ? watchId != "" && spectator?.match != null : StudentMatch() != null;
		DrawBrandLogo(compactMatchHeader ? new Rect(30, 15, 210, 105) : new Rect(510, 10, 180, 90));
		GUI.contentColor = Color.white;
		if (state == null && !teacherMode && browserMode)
		{
			GUI.Label(new Rect(70, 170, 1060, 55), "Connecting to your classroom teacher through Playroom...");
			GUI.Label(new Rect(70, 225, 1060, 60), "Keep the teacher classroom open. If the teacher disconnects, play waits safely.");
			if (Button(70, 310, 300, "Retry classroom connection"))
				Send(teacherKey != "" ? "teacher/state" : "join", new Command { classCode = code });
		}
		else if (state == null && !teacherMode)
		{
			GUI.Label(new Rect(40, 110, 180, 25), "Class code");
			code = GUI.TextField(new Rect(230, 108, 300, 30), code, 40);
			GUI.Label(new Rect(230, 148, 700, 32), "A historical commander is assigned when you join. No name needed.");
			if (Button(230, 190, 300, "Join waiting room"))
				Send("join", new Command { classCode = code.Trim().ToUpperInvariant() });
			GUI.Label(new Rect(40, 260, 180, 25), "Local teacher key");
			teacherKey = GUI.PasswordField(new Rect(230, 258, 500, 30), teacherKey, '*', 100);
			if (Button(230, 300, 300, "Open teacher desk"))
				Send("teacher/state", new Command());
			GUI.Label(new Rect(40, 350, 1000, 60), "Development identity: the local server prints the private teacher key.\nPlayroom host status never grants teacher access.");
		}
		else if (teacherMode)
		{
			DrawTeacher();
		}
		else
			DrawStudent();
		GUI.contentColor = new Color(.82f, .76f, .52f);
		string status = apiStatus != "" ? apiStatus : !string.IsNullOrEmpty(error) ? error : actionStatus != "" ? actionStatus : Time.unscaledTime < apiRecoveryUntil ? "Classroom connection restored." : "";
		bool matchHeader = teacherMode ? watchId != "" && spectator?.match != null : StudentMatch() != null;
		var connectionStyle = new GUIStyle(GUI.skin.label)
		{
			fontSize = 12,
			alignment = TextAnchor.MiddleCenter,
			wordWrap = false
		};
		GUI.Label(!matchHeader ? new Rect(30, 76, 460, 22) : new Rect(30, 125, 1140, 22), new GUIContent(status != "" ? status : presence, presence), connectionStyle);
		GUI.contentColor = Color.white;
		if (profileMatch?.phase == "setup")
		{
			if (teacherMode || !NeedsIntro(profileMatch))
				DrawSetupPanel(profileMatch);
		}
		else if (!DrawSelectedPieceCard(profileMatch))
			DrawFactCard();
		var current = teacherMode ? (watchId != "" ? spectator?.match : null) : StudentMatch();
		if (current != null)
		{
			DrawBattle(current, teacherMode);
			DrawEndgame(current, teacherMode);
			if (!teacherMode)
			{
				DrawTurnNotice();
				DrawTurnReminder();
				DrawTutorialTip();
			}

			DrawDeadlineNotice(current);
		}

		GUI.enabled = true;
		if (commanderOpen)
			DrawCommanderPanel(openCommander);
#if UNITY_WEBGL && !UNITY_EDITOR
		HS_SetPointer(pointerWanted ? 1 : 0);
#endif
	}

	Color TurnColor(int side)
	{
		return side == 0 ? new Color(1, .36f, .32f) : new Color(.35f, .68f, 1);
	}

	void DrawMatchHeader(MatchView m, string phase)
	{
		var style = new GUIStyle(GUI.skin.label)
		{
			fontSize = 27,
			fontStyle = FontStyle.Bold,
			alignment = TextAnchor.MiddleCenter,
			wordWrap = false
		};
		bool playing = phase == "active" && m.phase == "play" && !DeadlineBlocked(m) && !m.blocked && m.battle?.kind != "combat";
		string left = PlayerName(m, 1), right = PlayerName(m, 0);
		while (style.fontSize > 12 && style.CalcSize(new GUIContent(left)).x + style.CalcSize(new GUIContent(right)).x + 210 > 900)
			style.fontSize--;
		float gap = 70, w0 = style.CalcSize(new GUIContent(left)).x + 70, w1 = style.CalcSize(new GUIContent(right)).x + 70, x = 270 + (900 - w0 - w1 - gap) / 2;
		for (int column = 0; column < 2; column++)
		{
			int side = 1 - column;
			float xx = column == 0 ? x : x + w0 + gap, ww = column == 0 ? w0 : w1;
			bool active = playing && m.turn == side;
			GUI.contentColor = TurnColor(side) * (active ? (.88f + .12f * Mathf.Sin(Time.unscaledTime * 2.4f)) : 1);
			GUI.contentColor = new Color(GUI.contentColor.r, GUI.contentColor.g, GUI.contentColor.b, 1);
			var linkRect = new Rect(xx, matchHeaderY, ww, 42);
			var portraitRect = new Rect(xx + 4, matchHeaderY + 1, 38, 38);
			var nameRect = new Rect(xx + 46, matchHeaderY, ww - 46, 42);
			var commander = m.commanders != null && side < m.commanders.Length ? m.commanders[side] : null;
			var portrait = commander != null ? CommanderPortrait(commander.id) : null;
			if (portrait != null)
				GUI.DrawTexture(portraitRect, portrait, ScaleMode.ScaleToFit);
			bool available = m.commanders != null && side < m.commanders.Length && m.commanders[side] != null && m.battle?.kind != "combat" && m.phase != "over";
			if (available)
			{
				if (GUI.Button(linkRect, GUIContent.none, GUIStyle.none))
				{
					openCommander = m.commanders[side];
					openCommanderMatch = m.id;
					commanderOpen = true;
					commanderScroll = Vector2.zero;
					pointerWanted = false;
				}

				if (!commanderOpen)
					LinkPointer(linkRect);
				GUI.color = GUI.contentColor;
				GUI.DrawTexture(new Rect(nameRect.x + 8, matchHeaderY + 37, nameRect.width - 16, 1), Texture2D.whiteTexture);
				GUI.color = Color.white;
			}

			GUI.Label(nameRect, column == 0 ? left : right, style);
			if (active)
			{
				var small = new GUIStyle(GUI.skin.label)
				{
					fontSize = 13,
					alignment = TextAnchor.MiddleCenter
				};
				bool bannerOpen = !teacherMode && m.side == side && Time.unscaledTime - turnNoticeStart >= 0 && Time.unscaledTime - turnNoticeStart < 2;
				if (!bannerOpen)
					GUI.Label(new Rect(xx, 104, ww, 22), teacherMode ? "TO MOVE" : m.side == side ? "YOUR TURN" : "TO MOVE", small);
			}
		}

		GUI.contentColor = Color.white;
		style.fontSize = 18;
		GUI.Label(new Rect(x + w0, matchHeaderY, gap, 42), "vs", style);
	}

	const float matchHeaderY = 70;
	void UpdateTutorialTips(MatchView m)
	{
		tipVisible = false;
		if (teacherMode || m == null || state == null || string.IsNullOrEmpty(state.player))
			return;
		string key = state.player + ":" + m.id;
		if (tipKey != key)
		{
			tipKey = key;
#if UNITY_WEBGL && !UNITY_EDITOR
			tipSaved = HS_LoadTips(state.player, m.id);
#else
            tipSaved = PlayerPrefs.GetString("history.tips." + key, "");
#endif
			battleTips = new BattleTips(tipSaved);
			shownTip = 0;
		}

		if (m.events != null)
			foreach (var e in m.events)
				battleTips.Observe(m.side, e.kind, e.side, e.attacker, e.defender, e.outcome);
		bool eligible = pageReadable && apiStatus == "" && state.phase == "active" && m.phase == "play" && !DeadlineBlocked(m) && !m.blocked && m.battle?.kind != "combat" && !commanderOpen && motion == null && motions.Count == 0 && presentationMatch == m.id && receivedSeq >= m.seq && Time.unscaledTime >= localBattleUntil && Time.unscaledTime - turnNoticeStart >= 2 && Time.unscaledTime >= tipDismissUntil;
		int before = battleTips.Active;
		battleTips.Advance(eligible, readableSeconds);
		if (before != 0 && battleTips.Active == 0)
			tipDismissUntil = Time.unscaledTime + .65f;
		tipVisible = eligible && battleTips.Active != 0;
		tipClick.Observe(tipVisible ? tipKey + ":" + battleTips.Active : null, tipVisible);
		PersistTutorialTips(m);
		int visible = tipVisible ? battleTips.Active : 0;
		if (Application.absoluteURL.Contains("qa=1") && visible != shownTip)
			Debug.Log(visible == 0 ? "TIP_CLOSE" : "TIP_OPEN " + visible + " " + BattleTips.Text(visible));
		shownTip = visible;
	}

	void PersistTutorialTips(MatchView m)
	{
		string saved = battleTips.Save();
		if (saved != tipSaved)
		{
			tipSaved = saved;
#if UNITY_WEBGL && !UNITY_EDITOR
			HS_SaveTips(state.player, m.id, saved);
#else
            PlayerPrefs.SetString("history.tips." + tipKey, saved);
            PlayerPrefs.Save();
#endif
		}
	}

	bool HandleTipInput()
	{
		var input = Event.current;
		bool gesture = input.button == 0 && (input.type == EventType.MouseDown || input.type == EventType.MouseUp || input.type == EventType.MouseDrag);
		if (!gesture)
			return false;
		if (Time.unscaledTime < tipDismissUntil)
		{
			input.Use();
			return true;
		}

		var m = teacherMode ? null : StudentMatch();
		bool visible = tipVisible && m != null && tipKey == state.player + ":" + m.id && state.phase == "active" && m.battle?.kind != "combat" && !m.blocked && pageReadable && !commanderOpen && battleTips.Active != 0;
		string key = visible ? tipKey + ":" + battleTips.Active : null;
		bool eligible = visible && paintedTip == key;
		tipClick.Observe(key, eligible);
		if (!visible)
			return false;
		bool inside = rawPointer.x >= 0 && rawPointer.y >= 0 && rawPointer.x < Screen.width && rawPointer.y < Screen.height;
		if (input.type == EventType.MouseDown)
			tipClick.Press(input.clickCount, eligible && inside);
		else if (input.type == EventType.MouseUp)
		{
			GUIUtility.hotControl = 0;
			if (tipClick.Release(eligible && inside))
			{
				int dismissed = battleTips.Active;
				battleTips.Dismiss();
				PersistTutorialTips(m);
				tipVisible = false;
				paintedTip = "";
				tipDismissUntil = Time.unscaledTime + .65f;
				if (Application.absoluteURL.Contains("qa=1"))
					Debug.Log("TIP_DISMISS " + dismissed);
			}
		}

		// This gesture belongs only to the tip, never to board, links or combat.
		input.Use();
		return true;
	}

	void DrawTutorialTip()
	{
		if (!tipVisible)
			return;
		var style = new GUIStyle(GUI.skin.label)
		{
			fontSize = 25,
			alignment = TextAnchor.MiddleCenter,
			wordWrap = true
		};
		string message = BattleTips.Text(battleTips.Active);
		float textHeight = style.CalcHeight(new GUIContent(message), 1020);
		float height = Mathf.Max(154, textHeight + 90);
		GUI.color = new Color(.025f, .045f, .065f, .97f);
		GUI.DrawTexture(new Rect(60, 450 - height / 2, 1080, height), Texture2D.whiteTexture);
		GUI.color = Color.white;
		GUI.contentColor = accent;
		GUI.Label(new Rect(90, 458 - height / 2, 1020, 28), "STRATEGY TIP", new GUIStyle(GUI.skin.label) { fontSize = 18, alignment = TextAnchor.MiddleCenter });
		GUI.contentColor = Color.white;
		GUI.Label(new Rect(90, 490 - height / 2, 1020, textHeight), message, style);
		GUI.Label(new Rect(90, 450 + height / 2 - 28, 1020, 22), "Click anywhere to dismiss | closes automatically", new GUIStyle(GUI.skin.label) { fontSize = 14, alignment = TextAnchor.MiddleCenter });
		if (Event.current.type == EventType.Repaint)
			paintedTip = tipKey + ":" + battleTips.Active;
	}

	void DrawTurnReminder()
	{
		if (!reminderVisible || tipVisible || Time.unscaledTime - turnNoticeStart < 2)
			return;
		var style = new GUIStyle(GUI.skin.label)
		{
			fontSize = 26,
			alignment = TextAnchor.MiddleCenter,
			wordWrap = true
		};
		string message = ReadableTiming.Reminder(reminderKey);
		float height = Mathf.Max(110, style.CalcHeight(new GUIContent(message), 1020) + 32);
		GUI.color = new Color(.025f, .045f, .065f, .96f);
		GUI.DrawTexture(new Rect(60, 450 - height / 2, 1080, height), Texture2D.whiteTexture);
		GUI.color = Color.white;
		GUI.Label(new Rect(90, 466 - height / 2, 1020, height - 32), message, style);
	}

	void DrawTurnNotice()
	{
		float elapsed = Time.unscaledTime - turnNoticeStart;
		if (elapsed < 0 || elapsed >= 2)
			return;
		float width = Mathf.Lerp(360, 1080, Mathf.SmoothStep(0, 1, Mathf.Min(elapsed / .4f, 1))), alpha = Mathf.Min(1, (2 - elapsed) / .3f);
		GUI.color = new Color(.025f, .045f, .065f, .94f * alpha);
		GUI.DrawTexture(new Rect(600 - width / 2, 395, width, 110), Texture2D.whiteTexture);
		GUI.color = Color.white;
		GUI.contentColor = new Color(1, 1, 1, alpha);
		var style = new GUIStyle(GUI.skin.label)
		{
			fontSize = 48,
			fontStyle = FontStyle.Bold,
			alignment = TextAnchor.MiddleCenter
		};
		GUI.Label(new Rect(600 - width / 2, 395, width, 110), "YOUR TURN", style);
		GUI.contentColor = Color.white;
	}

	void DrawTeacher()
	{
		if (watchId != "")
		{
			DrawSpectator();
			return;
		}

		if (teacher == null)
			return;
		GUI.Label(new Rect(35, 105, 1100, 30), "Class " + teacher.classCode + " | " + teacher.phase + " | Select two students from the same faction to swap.");
		string[] actions =
		{
			"randomize",
			"start",
			"pause",
			"resume",
			"end"
		};
		int side0 = 0, side1 = 0, visibleAction = 0;
		foreach (var player in teacher.roster ?? Array.Empty<RosterEntry>())
			if (player.connected)
			{
				if (player.side == 0)
					side0++;
				else if (player.side == 1)
					side1++;
			}

		bool hasMatches = teacher.matches != null && teacher.matches.Length > 0;
		foreach (string action in actions)
		{
			if (!TeacherActionPolicy.Visible(action, teacher.phase, side0, side1, hasMatches))
				continue;
			if (Button(35 + visibleAction * 150, 145, 140, action.ToUpperInvariant()))
				Send("teacher/" + action, new Command());
			visibleAction++;
		}

		var layout = TeacherPairLayout.Build(teacher.roster);
		float contentHeight = layout.pairs.Length * 140 + 55 + layout.waiting.Length * 42;
		rosterScroll = GUI.BeginScrollView(new Rect(35, 195, 1130, 560), rosterScroll, new Rect(0, 0, 1095, Mathf.Max(560, contentHeight)));
		float y = 0;
		foreach (var pair in layout.pairs)
		{
			var match = TeacherPairLayout.MatchFor(pair, teacher.matches);
			GUI.Box(new Rect(0, y, 1090, 128), "");
			string status = match == null ? "Waiting for start" : teacher.phase == "ended" ? "Round ended" : (teacher.phase == "paused" ? "Paused | " : "") + (match.phase == "over" ? "Finished" : match.phase == "setup" ? "Setup" : "Playing");
			GUI.Label(new Rect(15, y + 10, 720, 28), "Pair " + pair.number + " | " + status);
			if (match != null)
			{
				if (Button(795, y + 8, 130, "Spectate"))
				{
					watchId = match.id;
					spectator = null;
					nextPoll = 0;
				}

				if (Button(940, y + 8, 130, "View log"))
				{
#if UNITY_WEBGL && !UNITY_EDITOR
					HS_OpenMatchLog(match.id);
#endif
				}
			}

			for (int i = 0; i < pair.members.Length; i++)
				DrawTeacherSeat(pair.members[i], 15 + (i % 2) * 535, y + 52, 515);
			y += 140;
		}

		GUI.Label(new Rect(10, y + 5, 1070, 28), "UNPAIRED / WAITING (" + layout.waiting.Length + ")");
		y += 45;
		foreach (var player in layout.waiting)
		{
			DrawTeacherSeat(player, 15, y, 1055);
			y += 42;
		}

		GUI.EndScrollView();
	}

	void DrawTeacherSeat(RosterEntry player, float x, float y, float width)
	{
		bool enabled = GUI.enabled;
		GUI.enabled = enabled && (teacher.phase == "waiting" || teacher.phase == "ended");
		Color background = GUI.backgroundColor;
		if (swap == player.id)
			GUI.backgroundColor = new Color(1f, .82f, .36f);
		bool clicked = Button(x, y, width, (swap == player.id ? "SELECTED | " : "") + player.name + (player.side == 1 ? " | Union" : " | Confederate") + (!player.connected ? " | Offline" : ""));
		GUI.backgroundColor = background;
		GUI.enabled = enabled;
		if (!clicked)
			return;
		if (swap == player.id)
		{
			swap = "";
			return;
		}

		if (swap == "")
		{
			swap = player.id;
			return;
		}

		var selectedPlayer = Array.Find(teacher.roster, p => p.id == swap);
		if (selectedPlayer == null)
		{
			swap = player.id;
			return;
		}

		if (selectedPlayer.side != player.side)
		{
			error = "Choose another player from the same faction to swap.";
			return;
		}

		Send("teacher/swap", new Command { a = swap, b = player.id });
		swap = "";
	}

	void DrawSpectator()
	{
		if (GUI.Button(new Rect(30, 150, 200, 24), "Back to teacher desk"))
		{
			watchId = "";
			spectator = null;
			nextPoll = 0;
			return;
		}

		if (spectator?.match == null)
		{
			GUI.Label(new Rect(30, 100, 1100, 30), "Loading teacher spectator view...");
			return;
		}

		var m = spectator.match;
		DrawMatchHeader(m, spectator.phase);
		GUI.Label(new Rect(245, 151, 220, 24), "Read-only | Fixed board");
		if (GUI.Button(new Rect(475, 150, 330, 24), "Watch " + SideName(m, 0)))
			Send("teacher/spectate", new Command { matchId = m.id, perspective = "red" });
		if (GUI.Button(new Rect(820, 150, 345, 24), "Watch " + SideName(m, 1)))
			Send("teacher/spectate", new Command { matchId = m.id, perspective = "blue" });
		DrawBoard(m, false, true);
		DrawSidebar(m, false);
	}

	void DrawStudent()
	{
		var m = StudentMatch();
		if (m == null)
		{
			var waitingHeading = new GUIStyle(GUI.skin.label)
			{
				fontSize = 25,
				fontStyle = FontStyle.Bold,
				wordWrap = true
			};
			string waiting = !state.paired ? "Please wait for your teacher to assign an opponent" : state.phase == "ended" || dismissedMatch != "" ? "Please wait for your teacher to arrange the next round" : "Please wait for your teacher to start";
			GUI.contentColor = accent;
			GUI.Label(new Rect(50, 110, 1100, 38), waiting, waitingHeading);
			GUI.contentColor = Color.white;
			if (state.commander != null)
			{
				string faction = state.commander.side == 1 ? "Union" : "Confederate";
				GUI.Label(new Rect(50, 153, 1100, 42), "You'll play as " + state.commander.fullName + " for the " + faction + " side.", new GUIStyle(GUI.skin.label) { fontSize = 19, wordWrap = true });
				DrawCommanderProfile(state.commander, new Rect(50, 205, 1100, 255));
			}

			DrawWaitingInstructions();
			return;
		}

		DrawMatchHeader(m, state.phase);
		if (NeedsIntro(m))
		{
			DrawMatchIntro(m);
			return;
		}

		bool editing = m.phase == "setup" && !m.ready[m.side] && state.phase == "active" && (m.setup == null || SetupRemaining(m) > 0);
		string hint = state.phase != "active" ? "Teacher has " + state.phase + " this round." : editing ? "Swap your pieces, then click Start Game below." : m.setupBlocked ? "Waiting for the setup notice to finish." : m.phase == "setup" ? "Waiting for opponent formation." : m.blocked || m.battle?.kind == "combat" ? "Combat reveal - waiting for both acknowledgments." : m.phase == "over" ? (m.winner == m.side ? "Victory!" : "Opponent wins.") : "";
		if (hint == "" && m.turnClock?.enabled == true && m.phase == "play")
			hint = m.turnClock.noticeRemainingMs > 0 ? "Automatic move pending." : (m.turn == m.side ? "Your turn" : PlayerName(m, m.turn) + " to move") + " | " + Math.Ceiling(m.turnClock.remainingMs / 1000) + " seconds";
		GUI.Label(new Rect(30, 151, 1130, 24), hint);
		DrawBoard(m, editing, false);
		DrawSidebar(m, editing);
	}

	void LinkPointer(Rect rect)
	{
		if (GUI.enabled && rect.Contains(Event.current.mousePosition))
			pointerWanted = true;
	}

	static bool DeadlineBlocked(MatchView m)
	{
		return m != null && (m.setupBlocked || m.turnClock?.noticeRemainingMs > 0);
	}

	bool HandleDeadlineInput(MatchView m)
	{
		if (teacherMode || !DeadlineBlocked(m))
			return false;
		if (Event.current.isMouse || Event.current.isKey || Event.current.type == EventType.ScrollWheel)
		{
			GUIUtility.hotControl = 0;
			Event.current.Use();
		}

		return true;
	}

	string deadlineNoticeKey = "";
	void DrawDeadlineNotice(MatchView m)
	{
		string phase = teacherMode ? spectator?.phase : state?.phase;
		bool setup = !teacherMode && m.setup?.noticeRemainingMs > 0 && phase != "ended";
		bool turn = m.turnClock?.noticeRemainingMs > 0 && m.phase == "play" && phase != "ended";
		string key = setup ? m.id + ":setup" : turn ? m.id + ":turn:" + m.seq : "";
		if (key != deadlineNoticeKey && Application.absoluteURL.Contains("qa=1"))
			Debug.Log(key == "" ? "DEADLINE_NOTICE_CLOSE" : "DEADLINE_NOTICE " + key);
		deadlineNoticeKey = key;
		if (!setup && !turn)
			return;
		string title = setup ? "Time's up!" : "Time's up - an automatic move will be made for you";
		if (turn && (teacherMode || m.turn != m.side))
			title = "Time's up - " + PlayerName(m, m.turn) + " will make an automatic move";
		string detail = setup ? "Your formation is locked." : "The server will choose one legal move. No click is needed.";
		if (setup && m.phase == "setup")
			detail += " Waiting for your opponent's formation.";
		if (phase == "paused")
			detail += " Your teacher has paused the session.";
		GUI.color = new Color(.025f, .045f, .065f, .98f);
		GUI.DrawTexture(new Rect(60, 345, 1080, 205), Texture2D.whiteTexture);
		GUI.color = Color.white;
		GUI.contentColor = accent;
		GUI.Label(new Rect(90, 365, 1020, 95), title, new GUIStyle(GUI.skin.label) { fontSize = 29, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter, wordWrap = true });
		GUI.contentColor = Color.white;
		GUI.Label(new Rect(100, 467, 1000, 65), detail, new GUIStyle(GUI.skin.label) { fontSize = 20, alignment = TextAnchor.MiddleCenter, wordWrap = true });
	}

	bool NeedsIntro(MatchView m)
	{
		return !teacherMode && m?.phase == "setup" && m.setup != null && !m.setup.started && !m.ready[m.side];
	}

	double SetupRemaining(MatchView m)
	{
		if (m.setup == null)
			return 60000;
		return Math.Max(0, m.setup.remainingMs - (state?.phase == "active" && m.setup.started ? (Time.unscaledTime - setupReceivedAt) * 1000 : 0));
	}

	void DrawMatchIntro(MatchView m)
	{
		GUI.Label(new Rect(35, 153, 1130, 32), "MEET YOUR OPPONENT - read both profiles before arranging your army", new GUIStyle(GUI.skin.label) { fontSize = 21, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter });
		GUI.contentColor = accent;
		GUI.Label(new Rect(35, 670, 1130, 36), "Capture the Flag to Win!", new GUIStyle(GUI.skin.label) { fontSize = 25, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter });
		GUI.contentColor = Color.white;
		if (m.commanders?.Length == 2)
		{
			DrawCommanderProfile(m.commanders[1], new Rect(35, 195, 550, 470), 1);
			DrawCommanderProfile(m.commanders[0], new Rect(615, 195, 550, 470), 2);
		}

		bool enabled = GUI.enabled;
		GUI.enabled = enabled && !busy && state.phase == "active";
		if (GUI.Button(new Rect(450, 770, 300, 48), "Start Game"))
			Send("setup/begin", new Command { matchId = m.id });
		GUI.enabled = enabled;
		if (state.phase != "active")
			GUI.Label(new Rect(250, 830, 700, 35), "Your teacher has paused the session. Please wait.");
	}

	void DrawSetupPanel(MatchView m)
	{
		Panel(new Rect(25, 747, 1150, 138));
		if (teacherMode)
		{
			GUI.Label(new Rect(45, 772, 1080, 80), "FORMATION SETUP - read-only spectator view. Each player starts their own timer after the matchup introduction.", new GUIStyle(GUI.skin.label) { fontSize = 22, wordWrap = true });
			return;
		}

		bool locked = m.ready[m.side];
		string heading = locked ? "FORMATION LOCKED - waiting for your opponent" : state.phase == "paused" ? "FORMATION SETUP - timer paused by teacher" : m.setup != null ? "FORMATION SETUP - " + Math.Ceiling(SetupRemaining(m) / 1000) + " seconds remaining" : "FORMATION SETUP";
		GUI.contentColor = accent;
		GUI.Label(new Rect(45, 757, 1080, 30), heading, new GUIStyle(GUI.skin.label) { fontSize = 23, fontStyle = FontStyle.Bold });
		GUI.contentColor = Color.white;
		string instructions = locked ? "Your army is ready. Play begins when both formations are locked." : m.setup != null ? "You have 60 seconds to arrange your army. Use Shuffle to randomize, or click two of your pieces to swap them. Click Start Game when you're ready." : "Use Shuffle to randomize, or click two of your pieces to swap them. Click Start Game when you're ready.";
		GUI.Label(new Rect(45, 795, 825, 70), instructions, new GUIStyle(GUI.skin.label) { fontSize = 19, wordWrap = true });
		bool enabled = GUI.enabled;
		GUI.enabled = enabled && !busy && !locked && state.phase == "active" && (m.setup == null || SetupRemaining(m) > 0);
		if (GUI.Button(new Rect(930, 794, 225, 39), "Start Game"))
			Send("setup", new Command { matchId = m.id, revision = m.setup?.revision ?? 0, ranks = m.setup == null ? formation : null });
		if (GUI.Button(new Rect(930, 842, 225, 30), "Shuffle"))
		{
			if (m.setup != null)
				Send("setup/shuffle", new Command { matchId = m.id, revision = m.setup.revision });
			else
			{
				formation = ArmyFormation.Generate();
				selected = -1;
			}
		}

		GUI.enabled = enabled;
	}

	Vector2 waitingInstructionsScroll;
	void DrawWaitingInstructions()
	{
		Panel(new Rect(50, 475, 1100, 287));
		GUI.contentColor = accent;
		GUI.Label(new Rect(70, 484, 1060, 28), "HOW TO PLAY - read while you wait", new GUIStyle(GUI.skin.label) { fontSize = 20, fontStyle = FontStyle.Bold });
		GUI.contentColor = Color.white;
		var body = new GUIStyle(GUI.skin.label)
		{
			fontSize = 17,
			wordWrap = true
		};
		string[] instructions =
		{
			"Goal: capture the enemy Flag or leave your opponent without a legal move. Your teacher controls pairing, Start, Pause and End.",
			"Setup: arrange all 40 pieces in your four home rows. Swap pieces to plan your defense, then click Start Game to lock your formation. Both players must be ready.",
			"On your turn, select your piece and a highlighted destination. Green means move; orange means attack. Move one square horizontally or vertically. Lakes, your own pieces and diagonal moves are off limits.",
			"Scouts can move any clear straight distance. Flag and Bombs cannot move. Enemy ranks stay hidden until combat; higher ranks win and equal ranks both leave the board.",
			"A Miner defuses a Bomb; other attackers lose to Bombs. A Spy beats a Marshal only when the Spy attacks. After combat, both players acknowledge the reveal before play continues.",
			"Plan ahead: protect your Flag, scout safely and remember revealed ranks. A third consecutive move by the same piece between the same two squares is not allowed. The in-game Instructions tab lists ranks and counts."
		};
		float height = 0;
		foreach (var text in instructions)
			height += body.CalcHeight(new GUIContent(text), 1040) + 10;
		waitingInstructionsScroll = GUI.BeginScrollView(new Rect(70, 520, 1060, 225), waitingInstructionsScroll, new Rect(0, 0, 1040, height));
		float y = 0;
		foreach (var text in instructions)
		{
			float h = body.CalcHeight(new GUIContent(text), 1040);
			GUI.Label(new Rect(0, y, 1040, h), text, body);
			y += h + 10;
		}

		GUI.EndScrollView();
	}

	Commander OwnCommander()
	{
		var m = StudentMatch();
		return m != null && m.commanders != null && m.side >= 0 && m.side < m.commanders.Length ? m.commanders[m.side] : state?.commander;
	}

	void DrawCommanderPanel(Commander commander)
	{
		GUI.color = new Color(0, 0, 0, .85f);
		GUI.DrawTexture(new Rect(10, 10, 1180, 880), Texture2D.whiteTexture);
		GUI.color = Color.white;
		Panel(new Rect(160, 150, 880, 590));
		DrawCommanderProfile(commander, new Rect(190, 190, 820, 475));
		if (GUI.Button(new Rect(470, 685, 260, 32), "Back to game"))
		{
			commanderOpen = false;
			combatDismissUntil = Time.unscaledTime + .65f;
		}

		if (Event.current.isMouse)
			Event.current.Use();
	}

	readonly Dictionary<string, Texture2D> commanderPortraits = new Dictionary<string, Texture2D>();
	Texture2D CommanderPortrait(string id)
	{
		if (string.IsNullOrEmpty(id))
			return null;
		if (!commanderPortraits.TryGetValue(id, out var portrait))
		{
			portrait = Resources.Load<Texture2D>("CommanderPortraits/" + id);
			commanderPortraits[id] = portrait;
		}

		return portrait;
	}

	void DrawCommanderProfile(Commander commander, Rect rect, int scrollSlot = 0)
	{
		if (commander == null)
			return;
		Panel(rect);
		var portrait = CommanderPortrait(commander.id);
		if (portrait != null)
		{
			GUI.DrawTexture(new Rect(rect.x + 20, rect.y + 18, 150, 150), portrait, ScaleMode.ScaleToFit);
			rect.x += 170;
			rect.width -= 170;
		}

		var body = new GUIStyle(GUI.skin.label)
		{
			fontSize = 17,
			wordWrap = true
		};
		var heading = new GUIStyle(body)
		{
			fontSize = 27,
			fontStyle = FontStyle.Bold
		};
		float width = rect.width - 56;
		string name = string.IsNullOrEmpty(commander.fullName) ? commander.name : commander.fullName;
		string roleText = (commander.side == 1 ? "Union" : "Confederate") + " | " + commander.role;
		var roleStyle = new GUIStyle(body)
		{
			fontSize = 16,
			fontStyle = FontStyle.Italic
		};
		float nameHeight = heading.CalcHeight(new GUIContent(name), width);
		float roleHeight = roleStyle.CalcHeight(new GUIContent(roleText), width);
		GUI.contentColor = TurnColor(commander.side);
		GUI.Label(new Rect(rect.x + 20, rect.y + 15, width, nameHeight), name, heading);
		GUI.contentColor = accent;
		GUI.Label(new Rect(rect.x + 20, rect.y + 18 + nameHeight, width, roleHeight), roleText, roleStyle);
		GUI.contentColor = Color.white;
		float bodyTop = 27 + nameHeight + roleHeight;
		string text = string.IsNullOrEmpty(commander.description) ? commander.summary + " " + commander.strategy : commander.description;
		float height = body.CalcHeight(new GUIContent(text), width);
		var noteStyle = new GUIStyle(body)
		{
			fontSize = 13
		};
		const string note = "This game uses Stratego rules; it does not recreate this commander’s historical battles.";
		float noteHeight = noteStyle.CalcHeight(new GUIContent(note), width);
		var profileScroll = GUI.BeginScrollView(new Rect(rect.x + 20, rect.y + bodyTop, rect.width - 40, rect.height - bodyTop - 18), scrollSlot == 0 ? commanderScroll : introScroll[scrollSlot - 1], new Rect(0, 0, width, height + 42 + noteHeight));
		if (scrollSlot == 0)
			commanderScroll = profileScroll;
		else
			introScroll[scrollSlot - 1] = profileScroll;
		GUI.Label(new Rect(0, 0, width, height), text, body);
		if (!string.IsNullOrEmpty(commander.sourceUrl) && Uri.TryCreate(commander.sourceUrl, UriKind.Absolute, out var source) && source.Scheme == "https")
		{
			var linkStyle = new GUIStyle(body)
			{
				alignment = TextAnchor.MiddleLeft,
				wordWrap = false
			};
			linkStyle.normal.textColor = linkColor;
			linkStyle.hover.textColor = Color.white;
			linkStyle.active.textColor = Color.white;
			float linkWidth = linkStyle.CalcSize(new GUIContent("Learn more")).x + 6;
			var linkRect = new Rect(0, height + 2, linkWidth, 26);
			LinkPointer(linkRect);
			if (GUI.Button(linkRect, "Learn more", linkStyle))
				Application.OpenURL(source.AbsoluteUri);
			GUI.color = linkRect.Contains(Event.current.mousePosition) ? Color.white : linkColor;
			GUI.DrawTexture(new Rect(0, height + 25, linkWidth, 1), Texture2D.whiteTexture);
			GUI.color = Color.white;
		}

		GUI.contentColor = new Color(.78f, .82f, .84f);
		GUI.Label(new Rect(0, height + 36, width, noteHeight), note, noteStyle);
		GUI.contentColor = Color.white;
		GUI.EndScrollView();
	}

	static readonly Color linkColor = new Color(.45f, .78f, 1f);
	static readonly Color accent = new Color(.85f, .73f, .48f);
	void Panel(Rect rect)
	{
		GUI.color = new Color(.055f, .085f, .10f);
		GUI.DrawTexture(rect, Texture2D.whiteTexture);
		GUI.color = accent;
		GUI.DrawTexture(new Rect(rect.x, rect.y, rect.width, 2), Texture2D.whiteTexture);
		GUI.color = Color.white;
	}

	readonly OwnPieceInspection ownInspection = new OwnPieceInspection();
	string detailLogKey = "";
	bool DrawSelectedPieceCard(MatchView m)
	{
		int inspecting = teacherMode ? -1 : ownInspection.Index(m);
		var piece = SelectedPieceDetails.Visible(m, teacherMode ? spectator?.phase : state?.phase, inspecting);
		if (piece == null || tabletop == null || tipVisible || commanderOpen)
		{
			if (detailLogKey != "" && Application.absoluteURL.Contains("qa=1"))
				Debug.Log("PIECE_DETAILS_CLOSE");
			detailLogKey = "";
			return false;
		}

		string key = m.id + ":" + m.seq + ":" + (inspecting >= 0 ? inspecting : m.selection.from) + ":" + piece.rank;
		if (key != detailLogKey && Application.absoluteURL.Contains("qa=1"))
			Debug.Log("PIECE_DETAILS " + piece.rank);
		detailLogKey = key;
		Panel(new Rect(25, 782, 1150, 103));
		GUI.color = new Color(.93f, .89f, .76f);
		GUI.DrawTexture(new Rect(39, 791, 80, 85), Texture2D.whiteTexture);
		GUI.color = Color.white;
		var art = tabletop.DetailArt(piece.rank, piece.side);
		if (tabletop.HasGeneratedArt(piece.rank))
			GUI.DrawTexture(new Rect(41, 793, 76, 81), art, ScaleMode.ScaleToFit, true);
		else
			GUI.DrawTextureWithTexCoords(new Rect(41, 793, 76, 81), art, new Rect(0, 1, 1, -1));
		GUI.contentColor = accent;
		GUI.Label(new Rect(136, 789, 1008, 25), BattleCaption.Piece(piece.rank) + (piece.rank == "B" || piece.rank == "F" ? "  /  CANNOT MOVE" : "  /  RANK " + piece.rank) + "  /  SELECTED", new GUIStyle(GUI.skin.label) { fontSize = 19, fontStyle = FontStyle.Bold });
		GUI.contentColor = Color.white;
		GUI.Label(new Rect(136, 820, 1008, 30), SelectedPieceDetails.Rule(piece.rank), new GUIStyle(GUI.skin.label) { fontSize = 16, wordWrap = true });
		GUI.contentColor = new Color(.77f, .83f, .85f);
		GUI.Label(new Rect(136, 857, 1008, 23), SelectedPieceDetails.Flavor(piece.rank), new GUIStyle(GUI.skin.label) { fontSize = 14, fontStyle = FontStyle.Italic });
		GUI.contentColor = Color.white;
		return true;
	}

	void DrawFactCard()
	{
		Panel(new Rect(25, 782, 1150, 103));
		var caption = new GUIStyle(GUI.skin.label)
		{
			fontSize = 12,
			fontStyle = FontStyle.Bold
		};
		GUI.contentColor = accent;
		string heading = facts.Length > 0 && !string.IsNullOrEmpty(facts[factIndex].lesson) ? "STRATEGY DISPATCH  /  " + facts[factIndex].lesson.ToUpperInvariant() : "DID YOU KNOW?";
		GUI.Label(new Rect(43, 788, 930, 20), heading, caption);
		GUI.contentColor = new Color(.92f, .94f, .94f);
		if (facts.Length > 0)
		{
			var f = facts[factIndex];
			var body = new GUIStyle(GUI.skin.label)
			{
				fontSize = 16,
				padding = new RectOffset(0, 0, 0, 0)
			};
			GUI.Label(new Rect(43, 810, 1112, 40), f.text, body);
			GUI.contentColor = Color.white;
			var sourceStyle = new GUIStyle(GUI.skin.label)
			{
				fontSize = 13,
				alignment = TextAnchor.MiddleLeft,
				wordWrap = false
			};
			sourceStyle.normal.textColor = linkColor;
			sourceStyle.hover.textColor = Color.white;
			string sourceText = "Source: " + f.source;
			float sourceWidth = Mathf.Min(1090, sourceStyle.CalcSize(new GUIContent(sourceText)).x + 8);
			LinkPointer(new Rect(43, 851, sourceWidth, 28));
			if (GUI.Button(new Rect(43, 851, sourceWidth, 28), sourceText, sourceStyle))
				Application.OpenURL(f.url);
			GUI.color = new Rect(43, 851, sourceWidth, 28).Contains(Event.current.mousePosition) ? Color.white : linkColor;
			GUI.DrawTexture(new Rect(43, 875, sourceWidth, 1), Texture2D.whiteTexture);
			GUI.color = Color.white;
			var countStyle = new GUIStyle(GUI.skin.label)
			{
				fontSize = 12,
				alignment = TextAnchor.MiddleRight
			};
			GUI.contentColor = accent;
			GUI.Label(new Rect(970, 789, 185, 20), (factIndex + 1) + " / " + facts.Length, countStyle);
		}

		GUI.contentColor = Color.white;
	}

	void DrawSidebar(MatchView m, bool editing)
	{
		if (m.phase == "play" && m.ready != null && m.ready.Length == 2 && m.ready[0] && m.ready[1] && dispatchStarted.Add(m.id))
		{
			sidebarTab = 1;
			if (Application.absoluteURL.Contains("qa=1"))
				Debug.Log("SIDEBAR_MATCH_STARTED " + m.id);
		}

		Panel(new Rect(895, 178, 285, 555));
		float tabsY = 190;
		var tabStyle = new GUIStyle(GUI.skin.button)
		{
			fontSize = 12,
			fontStyle = FontStyle.Bold,
			wordWrap = true,
			alignment = TextAnchor.MiddleCenter,
			padding = new RectOffset(3, 3, 1, 1)
		};
		for (int tab = 0; tab < 2; tab++)
		{
			GUI.contentColor = sidebarTab == tab ? accent : Color.white;
			if (GUI.Button(new Rect(906 + tab * 131, tabsY, 128, 32), tab == 0 ? "Instructions" : "Game Log", tabStyle))
			{
				sidebarTab = tab;
				if (Application.absoluteURL.Contains("qa=1"))
					Debug.Log("SIDEBAR_TAB " + tab);
			}

			if (sidebarTab == tab)
			{
				GUI.color = accent;
				GUI.DrawTexture(new Rect(909 + tab * 131, tabsY + 32, 122, 2), Texture2D.whiteTexture);
				GUI.color = Color.white;
			}
		}

		GUI.contentColor = Color.white;
		var viewport = new Rect(906, tabsY + 48, 263, 720 - tabsY - 48);
		var body = new GUIStyle(GUI.skin.label)
		{
			fontSize = 15,
			padding = new RectOffset(0, 0, 0, 0)
		};
		if (sidebarTab == 0)
		{
			string objective = "Capture the Flag or leave your opponent without a legal move.";
			string[] guide =
			{
				"Higher ranks win; equal ranks both leave the board.",
				"Spy beats Marshal only when attacking. Miners defuse Bombs.",
				"Scouts move any clear straight distance. Flag and Bombs stay put.",
				"Select a piece, then a highlighted destination. Green: move. Orange: attack. Gold: selected."
			};
			float objectiveHeight = body.CalcHeight(new GUIContent(objective), 238), guideHeight = 0;
			foreach (string paragraph in guide)
				guideHeight += body.CalcHeight(new GUIContent(paragraph), 238) + 10;
			float rankY = 24 + objectiveHeight + 14 + 24 + guideHeight + 4;
			instructionsScroll = GUI.BeginScrollView(viewport, instructionsScroll, new Rect(0, 0, 240, rankY + 230));
			var heading = new GUIStyle(body)
			{
				fontSize = 13,
				fontStyle = FontStyle.Bold
			};
			GUI.contentColor = accent;
			GUI.Label(new Rect(0, 0, 238, 22), "OBJECTIVE", heading);
			GUI.contentColor = Color.white;
			GUI.Label(new Rect(0, 24, 238, objectiveHeight), objective, body);
			float y = 24 + objectiveHeight + 14;
			GUI.contentColor = accent;
			GUI.Label(new Rect(0, y, 238, 22), "FIELD GUIDE", heading);
			GUI.contentColor = Color.white;
			y += 24;
			foreach (string paragraph in guide)
			{
				float height = body.CalcHeight(new GUIContent(paragraph), 238);
				GUI.Label(new Rect(0, y, 238, height), paragraph, body);
				y += height + 10;
			}

			GUI.contentColor = accent;
			GUI.Label(new Rect(0, rankY, 238, 22), "YOUR 40-PIECE ARMY", heading);
			GUI.contentColor = Color.white;
			var rankStyle = new GUIStyle(body)
			{
				fontSize = 13
			};
			for (int j = 0; j < ranks.Length; j++)
				GUI.Label(new Rect((j % 2) * 120, rankY + 28 + (j / 2) * 25, 118, 24), Label(ranks[j]) + " x" + counts[j], rankStyle);
			GUI.contentColor = new Color(.66f, .74f, .77f);
			GUI.Label(new Rect(0, rankY + 185, 238, 45), "Abstract strategy game. Historical facts describe real events separately.", rankStyle);
			GUI.contentColor = Color.white;
			GUI.EndScrollView();
		}
		else
		{
			var events = m.events ?? Array.Empty<Dispatch>();
			float height = 35;
			foreach (var e in events)
				height += body.CalcHeight(new GUIContent(e.text ?? ""), 234) + 42;
			dispatchScroll = GUI.BeginScrollView(viewport, dispatchScroll, new Rect(0, 0, 240, Mathf.Max(viewport.height, height)));
			GUI.contentColor = accent;
			GUI.Label(new Rect(0, 0, 225, 22), events.Length == 0 ? "No moves yet." : "PUBLIC MATCH RECORD", new GUIStyle(body) { fontSize = 12, fontStyle = FontStyle.Bold });
			GUI.contentColor = Color.white;
			float y = 35;
			foreach (var e in events)
			{
				GUI.contentColor = accent;
				GUI.Label(new Rect(0, y, 234, 18), "#" + e.seq + "  " + (e.kind ?? "dispatch").ToUpperInvariant(), new GUIStyle(body) { fontSize = 11 });
				GUI.contentColor = Color.white;
				float h = body.CalcHeight(new GUIContent(e.text ?? ""), 234);
				GUI.Label(new Rect(0, y + 22, 234, h), e.text ?? "", body);
				y += h + 42;
			}

			GUI.EndScrollView();
		}
	}

	void LoadDismissal()
	{
		if (state == null || string.IsNullOrEmpty(state.player) || state.player == dismissedPlayer)
			return;
		dismissedPlayer = state.player;
		dismissedMatch = "";
#if UNITY_WEBGL && !UNITY_EDITOR
		dismissedMatch = HS_LoadDismissed(dismissedPlayer);
#endif
	}

	MatchView StudentMatch()
	{
		var m = state?.match;
		return m != null && EndgamePresentation.Dismissed(m.id, dismissedMatch, m.phase, state.phase) ? null : m;
	}

	bool ResultReady(MatchView m, bool teacherView)
	{
		return EndgamePresentation.Ready(m.phase, teacherView ? spectator.phase : state.phase, m.battle?.kind == "combat", m.blocked, motion != null || motions.Count > 0 || (localBattle != null && Time.unscaledTime < localBattleUntil));
	}

	void DismissFinished(MatchView m)
	{
		if (!ResultReady(m, false))
			return;
		dismissedMatch = m.id;
		selected = -1;
		pending = null;
		motions.Clear();
		motion = null;
		localBattle = null;
#if UNITY_WEBGL && !UNITY_EDITOR
		HS_SaveDismissed(state.player, m.id);
#endif
		if (Application.absoluteURL.Contains("qa=1"))
			Debug.Log("ENDGAME_LOBBY " + m.id);
	}

	void DrawEndgame(MatchView m, bool teacherView)
	{
		if (!ResultReady(m, teacherView))
			return;
		bool won = EndgamePresentation.WinnerKnown(m.phase, m.winner), flag = false, noLegal = false;
		if (m.events != null)
			foreach (var e in m.events)
			{
				if (e.kind == "combat" && e.defender == "F" && e.outcome > 0)
					flag = true;
				if (e.text == "No legal moves remain.")
					noLegal = true;
			}

		string title = EndgamePresentation.Title(teacherView, m.side, m.phase, m.winner), winner = won ? "Winner: " + SideName(m, m.winner) : "Session closed by the teacher", reason = EndgamePresentation.Reason(won, flag, noLegal);
		if (Application.absoluteURL.Contains("qa=1") && endgameLogged != m.id + title)
		{
			endgameLogged = m.id + title;
			Debug.Log("ENDGAME_SCREEN " + m.id + " | " + title + " | " + winner + " | " + reason);
		}

		Color resultColor = won ? TurnColor(m.winner) : accent;
		GUI.color = resultColor;
		GUI.DrawTexture(new Rect(170, 210, 860, 400), Texture2D.whiteTexture);
		GUI.color = new Color(.035f, .06f, .075f, 1);
		GUI.DrawTexture(new Rect(172, 212, 856, 396), Texture2D.whiteTexture);
		GUI.color = Color.white;
		var heading = new GUIStyle(GUI.skin.label)
		{
			fontSize = 38,
			fontStyle = FontStyle.Bold,
			alignment = TextAnchor.MiddleCenter
		};
		GUI.contentColor = resultColor;
		GUI.Label(new Rect(195, 230, 810, 65), title, heading);
		GUI.contentColor = Color.white;
		var centered = new GUIStyle(GUI.skin.label)
		{
			fontSize = 19,
			alignment = TextAnchor.MiddleCenter
		};
		GUI.Label(new Rect(230, 301, 740, 28), teacherView ? "Read-only match result" : won ? (m.winner == m.side ? "You won this match." : "You lost this match.") : "Round closed.", centered);
		GUI.Label(new Rect(230, 335, 740, 38), winner, centered);
		GUI.Label(new Rect(230, 378, 740, 38), reason, centered);
		string flavor = EndgamePresentation.Flavor(m.id, m.phase, m.winner);
		var flavorStyle = new GUIStyle(centered)
		{
			fontSize = 20,
			fontStyle = FontStyle.Italic
		};
		GUI.contentColor = resultColor;
		GUI.Label(new Rect(230, 421, 740, 58), flavor, flavorStyle);
		GUI.contentColor = Color.white;
		GUI.Label(new Rect(240, 488, 720, 45), teacherView ? "Return to the teacher desk to manage the next round." : "Return to the waiting room for your teacher's next round.", new GUIStyle(centered) { fontSize = 16 });
		if (teacherView)
		{
			if (Button(365, 545, 470, "Back to matches"))
			{
				watchId = "";
				spectator = null;
				nextPoll = 0;
			}
		}
		else if (Button(365, 545, 470, "Back to waiting room"))
			DismissFinished(m);
	}

	readonly Rect boardRect = new Rect(25, 178, 865, 555);
	const int boardRenderWidth = 1400, boardRenderHeight = 899;
	TabletopBoard tabletop;
	int shownSeq = -1;
	float feedbackUntil, boostUntil;
	bool[] Hints(MatchView m, PieceView[] b)
	{
		var hints = new bool[100];
		if (selected < 0 || b[selected] == null || b[selected].side != m.side)
			return hints;
		string rank = b[selected].rank;
		if (rank == "F" || rank == "B")
			return hints;
		int[] dx =
		{
			1,
			-1,
			0,
			0
		}, dy =
		{
			0,
			0,
			1,
			-1
		};
		for (int d = 0; d < 4; d++)
			for (int n = 1; n <= (rank == "2" ? 9 : 1); n++)
			{
				int x = selected % 10 + dx[d] * n, y = selected / 10 + dy[d] * n;
				if (x < 0 || x > 9 || y < 0 || y > 9)
					break;
				int i = y * 10 + x;
				if (TabletopBoard.Lake(i) || b[i]?.side == m.side)
					break;
				hints[i] = true;
				if (b[i] != null)
					break;
			}

		return hints;
	}

	readonly Queue<Dispatch> motions = new Queue<Dispatch>();
	Dispatch motion, localBattle;
	float motionStart, battleStart, localBattleUntil;
	int receivedSeq, battleSeq = -1;
	string presentationMatch = "";
	TabletopBoard battleStage;
	void Track(MatchView m)
	{
		if (presentationMatch != m.id)
		{
			presentationMatch = m.id;
			receivedSeq = m.seq;
			motions.Clear();
			motion = null;
			localBattle = null;
			battleSeq = -1;
		}
		else if (m.seq > receivedSeq)
		{
			foreach (var e in m.events)
				if (e.seq > receivedSeq && (e.kind == "move" || e.kind == "combat"))
					motions.Enqueue(e);
			receivedSeq = m.seq;
		}

		if (motion != null && Time.unscaledTime - motionStart > 1.55f)
		{
			if (motion.kind == "combat")
			{
				localBattle = motion;
				localBattleUntil = Time.unscaledTime + 4;
			}

			motion = null;
		}

		if (motion == null && motions.Count > 0 && Time.unscaledTime > localBattleUntil)
		{
			motion = motions.Dequeue();
			motionStart = Time.unscaledTime;
		}

		if (motion != null)
			boostUntil = Time.unscaledTime + .2f;
	}

	void DrawBoard(MatchView m, bool editing, bool readOnly)
	{
		Track(m);
		if (tabletop == null)
			tabletop = new GameObject("Tabletop view").AddComponent<TabletopBoard>();
		var b = (PieceView[])m.board.Clone();
		if (!readOnly && m.phase == "setup" && !m.ready[m.side])
			for (int k = 0; k < 40; k++)
				b[m.side == 0 ? 60 + k : 39 - k] = new PieceView
				{
					side = m.side,
					rank = formation[k]
				};
		if (shownSeq != m.seq)
		{
			shownSeq = m.seq;
			feedbackUntil = Time.unscaledTime + 4;
			boostUntil = Time.unscaledTime + .5f;
		}

		int from = -1, to = -1;
		if (Time.unscaledTime < feedbackUntil && m.events != null)
			for (int j = m.events.Length - 1; j >= 0; j--)
			{
				var e = m.events[j];
				if (e.from != e.to)
				{
					from = e.from;
					to = e.to;
					break;
				}
			}

		bool[] hints = null;
		int highlight = editing ? selected : -1;
		if (!editing && m.selection != null && m.selection.targets != null && !m.blocked)
		{
			highlight = m.selection.from;
			hints = new bool[100];
			foreach (var target in m.selection.targets)
				hints[target.to] = true;
		}

		float travel = motion == null ? 1 : Mathf.Clamp01((Time.unscaledTime - motionStart - .35f) / 1.2f);
		if (motion != null)
		{
			b[motion.from] = new PieceView
			{
				side = motion.side,
				rank = motion.moving
			};
			b[motion.to] = motion.kind == "combat" ? new PieceView
			{
				side = 1 - motion.side,
				rank = motion.defender
			}

			: null;
			highlight = motion.from;
			hints = new bool[100];
			if (motion.targets != null)
				foreach (var target in motion.targets)
					hints[target.to] = true;
		}

		if (!readOnly && manualSelectionRequested >= 0)
		{
			highlight = manualSelectionRequested;
			hints = m.selection?.from == manualSelectionRequested ? hints : null;
		}

		if (!readOnly && ownInspection.Index(m) != -1)
		{
			highlight = ownInspection.Index(m);
			hints = null;
		}

		int rotate = readOnly ? 0 : m.side;
		var texture = tabletop.Render(b, rotate, highlight, hints, from, to, boardRenderWidth, boardRenderHeight);
		if (motion != null)
			tabletop.AnimateMove(motion.from, motion.to, rotate, travel * (motion.kind == "combat" ? .7f : 1));
		GUI.DrawTexture(boardRect, texture, ScaleMode.StretchToFill, true);
		if (!commanderOpen && !readOnly && !EndgamePresentation.Terminal(m.phase, state.phase) && motion == null && m.battle?.kind != "combat" && !m.blocked && Event.current.type == EventType.MouseDown && Event.current.button == 0)
		{
			Vector3 raw = new Vector3(rawPointer.x, rawPointer.y, 0);
			Vector2 mouse = GUI.matrix.inverse.MultiplyPoint(raw);
			if (boardRect.Contains(mouse))
			{
				int i = tabletop.Pick(new Vector2((mouse.x - boardRect.x) / boardRect.width, 1 - (mouse.y - boardRect.y) / boardRect.height), rotate);
				if (Application.absoluteURL.Contains("qa=1"))
					Debug.Log("BOARD_PICK " + i + " GUI " + mouse);
				if (i >= 0 && !TabletopBoard.Lake(i))
					Click(i, b[i], editing);
				boostUntil = Time.unscaledTime + 1;
				Event.current.Use();
			}
		}
	}

	void Click(int i, PieceView p, bool editing)
	{
		var m = state.match;
		if (DeadlineBlocked(m))
			return;
		if (editing)
		{
			int k = m.side == 0 ? i - 60 : 39 - i;
			if (k < 0 || k >= 40)
				return;
			if (selected < 0)
				selected = i;
			else
			{
				int a = m.side == 0 ? selected - 60 : 39 - selected;
				if (m.setup != null)
				{
					if (busy)
						return;
					if (a != k)
						Send("setup/swap", new Command { matchId = m.id, from = a, to = k, revision = m.setup.revision });
				}
				else
					(formation[a], formation[k]) = (formation[k], formation[a]);
				selected = -1;
			}

			return;
		}

		if (state.phase == "active" && m.phase == "play" && m.turn == m.side && !m.blocked && m.battle?.kind != "combat" && motion == null && p != null && p.side == m.side && (p.rank == "B" || p.rank == "F"))
		{
			ownInspection.Toggle(m, i);
			selected = -1;
			manualSelectionRequested = -1;
			pendingManualSelect = null;
			pending = null;
			autoSelectionCandidates = null;
			RememberSelectionTurn(m);
			return;
		}

		if (ownInspection.Index(m) != -1 && (p == null || p.side != m.side))
		{
			ownInspection.Deselect(m);
			selected = -1;
			return;
		}

		if (p != null && p.side == m.side && p.rank != "B" && p.rank != "F")
			ownInspection.Clear();
		if (busy)
		{
			if (!editing && state.phase == "active" && m.phase == "play" && m.turn == m.side && !DeadlineBlocked(m) && !m.blocked && m.battle?.kind != "combat" && p != null && p.side == m.side && p.rank != "F" && p.rank != "B")
			{
				autoSelectionCandidates = null;
				RememberSelectionTurn(m);
				selected = i;
				manualSelectionRequested = i;
				pendingManualSelect = new Command
				{
					from = i,
					seq = m.seq,
					matchId = m.id
				};
			}

			return;
		}

		if (state.phase != "active" || m.phase != "play" || m.turn != m.side || m.blocked || m.battle?.kind == "combat" || motion != null)
			return;
		autoSelectionCandidates = null;
		RememberSelectionTurn(m);
		if (p != null && p.side == m.side)
		{
			if (p.rank == "F" || p.rank == "B")
				return;
			selected = i;
			manualSelectionRequested = i;
			Send("select", new Command { from = i, seq = m.seq });
			return;
		}

		if (selected < 0 || m.selection?.targets == null || !Array.Exists(m.selection.targets, t => t.to == i))
			return;
		if (pending == null || pending.from != selected || pending.to != i || pending.seq != m.seq)
			pending = new Command
			{
				from = selected,
				to = i,
				seq = m.seq,
				requestId = Guid.NewGuid().ToString()
			};
		Send("move", pending);
	}

	string Banter(MatchView m, Dispatch target)
	{
		string previous = "";
		if (m.events != null)
			foreach (var e in m.events)
			{
				if (e.kind != "combat" || e.seq > target.seq)
					continue;
				previous = BattleBanter.Choose(m.id, e.seq, e.attacker, e.defender, e.outcome, previous);
				if (e.seq == target.seq)
					return previous;
			}

		return BattleBanter.Choose(m.id, target.seq, target.attacker, target.defender, target.outcome, previous);
	}

	void BattleRole(Rect rect, string text, int side)
	{
		GUI.color = side == 0 ? new Color(.54f, .12f, .10f) : new Color(.08f, .27f, .46f);
		GUI.DrawTexture(rect, Texture2D.whiteTexture);
		GUI.color = Color.white;
		var style = new GUIStyle(GUI.skin.label)
		{
			fontSize = 17,
			fontStyle = FontStyle.Bold,
			alignment = TextAnchor.MiddleCenter
		};
		style.normal.textColor = Color.white;
		GUI.Label(rect, text, style);
	}

	void RememberSelectionTurn(MatchView m)
	{
		autoSelectionSeq = m.seq;
#if UNITY_WEBGL && !UNITY_EDITOR
		HS_SaveSelectionTurn(state.player, m.id, m.seq.ToString());
#endif
	}

	void UpdateAutoSelection(MatchView m, bool actionable)
	{
		if (m == null || teacherMode || m.phase != "play" || ownInspection.Index(m) != -1)
			return;
		if (autoSelectionMatch != m.id)
		{
			autoSelectionMatch = m.id;
			autoSelectionSeq = -1;
			autoSelectionCandidates = null;
#if UNITY_WEBGL && !UNITY_EDITOR
			int saved;
			if (int.TryParse(HS_LoadSelectionTurn(state.player, m.id), out saved))
				autoSelectionSeq = saved;
#endif
		}

		if (m.turn != m.side)
		{
			selected = -1;
			autoSelectionCandidates = null;
		}

		if (!actionable || busy || pendingCombatAck != null || pendingManualSelect != null || manualSelectionRequested >= 0)
			return;
		if (m.selection?.targets != null && m.selection.targets.Length > 0 && m.selection.side == m.side && m.selection.seq == m.seq)
		{
			selected = m.selection.from;
			RememberSelectionTurn(m);
			autoSelectionCandidates = null;
			return;
		}

		if (autoSelectionSeq != m.seq)
		{
			RememberSelectionTurn(m);
			autoSelectionCandidates = selected < 0 ? AutoSelectionPolicy.Candidates(m) : null;
			autoSelectionIndex = 0;
		}

		if (autoSelectionCandidates == null || autoSelectionIndex >= autoSelectionCandidates.Length)
			return;
		int from = autoSelectionCandidates[autoSelectionIndex++];
		selected = from;
		if (Application.absoluteURL.Contains("qa=1"))
			Debug.Log("AUTO_SELECTION " + m.id + " " + m.seq + " " + from);
		Send("select", new Command { from = from, seq = m.seq });
	}

	float nextContinueRegistration;
	void UpdateAutomaticContinue()
	{
		var m = teacherMode ? null : StudentMatch();
		var battle = m?.battle;
		bool manualReady = battle?.kind == "combat" && apiStatus == "" && battleSeq == battle.seq && motion == null && motions.Count == 0 && Time.unscaledTime - battleStart >= 2.3f && !battle.ack[m.side];
		bool eligible = manualReady && state.phase == "active";
		string key = battle?.kind == "combat" ? m.id + ":" + battle.seq : null;
		if (m?.battleContinue?.supported == true)
		{
			combatClick.Observe(key, manualReady);
			if (manualReady && state.phase != "ended" && !m.battleContinue.armed && !busy && Time.unscaledTime >= nextContinueRegistration)
			{
				nextContinueRegistration = Time.unscaledTime + 1;
				Send("battle/ready", new Command { matchId = m.id, seq = battle.seq });
			}

			return;
		}

		revealTiming.Observe(key, eligible, readableSeconds);
		combatClick.Observe(key, manualReady);
		if (eligible && revealTiming.Elapsed >= 5 && pendingCombatAck == null && combatClick.AutoAdvance(true))
		{
			pendingCombatAck = new Command
			{
				seq = battle.seq,
				matchId = m.id,
				automatic = true
			};
			combatDismissUntil = Time.unscaledTime + .65f;
		}
	}

	void HandleCombatInput()
	{
		var input = Event.current;
		if (Time.unscaledTime < combatDismissUntil && input.button == 0 && (input.type == EventType.MouseDown || input.type == EventType.MouseUp || input.type == EventType.MouseDrag))
		{
			input.Use();
			return;
		}

		var m = teacherMode ? null : StudentMatch();
		var battle = m?.battle;
		if (battle?.kind != "combat")
		{
			combatClick.Observe(null, false);
			return;
		}

		bool eligible = apiStatus == "" && battleSeq == battle.seq && motion == null && motions.Count == 0 && Time.unscaledTime - battleStart >= 2.3f && !battle.ack[m.side];
		combatClick.Observe(m.id + ":" + battle.seq, eligible);
		if (Application.absoluteURL.Contains("qa=1") && Event.current.isMouse)
			Debug.Log("COMBAT_INPUT " + Event.current.type + " ready=" + eligible + " count=" + input.clickCount + " motion=" + (motion != null) + " queued=" + motions.Count);
		if (input.button != 0 || (input.type != EventType.MouseDown && input.type != EventType.MouseUp))
			return;
		bool inside = rawPointer.x >= 0 && rawPointer.y >= 0 && rawPointer.x < Screen.width && rawPointer.y < Screen.height;
		if (input.type == EventType.MouseDown)
			combatClick.Press(input.clickCount, eligible && inside);
		else if (combatClick.Release(eligible && inside))
		{
			pendingCombatAck = new Command
			{
				seq = battle.seq,
				matchId = m.id
			};
			combatDismissUntil = Time.unscaledTime + .65f;
		}

		// Consume the whole dismissal gesture before any board, tab, fact or result control sees it.
		input.Use();
	}

	void DrawBattle(MatchView m, bool readOnly)
	{
		var e = readOnly && localBattle != null && Time.unscaledTime < localBattleUntil ? localBattle : m.battle;
		if (e == null || e.kind != "combat" || motion != null)
			return;
		if (battleSeq != e.seq)
		{
			if (Application.absoluteURL.Contains("qa=1"))
				Debug.Log("BATTLE_BANTER " + e.seq + " " + Banter(m, e));
			battleSeq = e.seq;
			battleStart = Time.unscaledTime;
			if (battleStage != null)
				Destroy(battleStage.gameObject);
			battleStage = new GameObject("Separate battle stage").AddComponent<TabletopBoard>();
		}

		float elapsed = Time.unscaledTime - battleStart, progress = Mathf.Clamp01(elapsed / 2.3f);
		if (progress < 1)
			boostUntil = Time.unscaledTime + .2f;
		GUI.color = new Color(.035f, .06f, .075f, 1);
		GUI.DrawTexture(new Rect(25, 178, 1150, 555), Texture2D.whiteTexture);
		GUI.color = Color.white;
		GUI.Box(new Rect(25, 178, 1150, 555), "");
		var header = new GUIStyle(GUI.skin.label)
		{
			fontSize = 24,
			fontStyle = FontStyle.Bold,
			alignment = TextAnchor.MiddleCenter
		};
		GUI.Label(new Rect(70, 195, 1060, 60), BattleCaption.Describe(PlayerName(m, e.side), PlayerName(m, 1 - e.side), e.attacker, e.defender, e.outcome), header);
		BattleRole(new Rect(130, 270, 435, 58), "ATTACKER | " + SideName(m, e.side) + "\n" + Label(e.attacker), e.side);
		BattleRole(new Rect(635, 270, 435, 58), "DEFENDER | " + SideName(m, 1 - e.side) + "\n" + Label(e.defender), 1 - e.side);
		GUI.DrawTexture(new Rect(115, 340, 970, 210), battleStage.Battle(e, progress), ScaleMode.ScaleToFit, false);
		string quote = Banter(m, e), speaker = CutscenePresentation.Speaker(quote, e.attacker, e.defender, e.outcome, PlayerName(m, e.outcome > 0 ? e.side : 1 - e.side));
		var quip = new GUIStyle(GUI.skin.label)
		{
			fontSize = 22,
			fontStyle = FontStyle.Italic,
			alignment = TextAnchor.MiddleCenter
		};
		var credit = new GUIStyle(GUI.skin.label)
		{
			fontSize = 16,
			alignment = TextAnchor.MiddleCenter,
			wordWrap = true
		};
		string quotation = BattleBanter.Category(e.attacker, e.defender, e.outcome) == "six-seven" ? quote : "\"" + quote + "\"";
		float quoteHeight = quip.CalcHeight(new GUIContent(quotation), 930);
		float creditHeight = speaker == "" ? 0 : credit.CalcHeight(new GUIContent("- " + speaker), 930);
		while (quoteHeight + creditHeight + 28 > 132 && quip.fontSize > 16)
		{
			quip.fontSize--;
			quoteHeight = quip.CalcHeight(new GUIContent(quotation), 930);
		}

		var quoteBox = new Rect(115, 554, 970, Mathf.Max(102, quoteHeight + creditHeight + 28));
		GUI.color = new Color(.055f, .08f, .09f);
		GUI.DrawTexture(quoteBox, Texture2D.whiteTexture);
		GUI.color = accent;
		GUI.DrawTexture(new Rect(quoteBox.x, quoteBox.y, quoteBox.width, 2), Texture2D.whiteTexture);
		GUI.DrawTexture(new Rect(quoteBox.x, quoteBox.yMax - 2, quoteBox.width, 2), Texture2D.whiteTexture);
		GUI.DrawTexture(new Rect(quoteBox.x, quoteBox.y, 2, quoteBox.height), Texture2D.whiteTexture);
		GUI.DrawTexture(new Rect(quoteBox.xMax - 2, quoteBox.y, 2, quoteBox.height), Texture2D.whiteTexture);
		GUI.color = Color.white;
		GUI.Label(new Rect(135, quoteBox.y + 10, 930, quoteHeight), quotation, quip);
		if (speaker != "")
			GUI.Label(new Rect(135, quoteBox.y + quoteHeight + 17, 930, creditHeight), "- " + speaker, credit);
		if (!readOnly && (e.ack[m.side] || elapsed >= 2.3f))
			GUI.Label(new Rect(115, quoteBox.yMax + 10, 970, 30), e.ack[m.side] ? "Waiting for the other player to continue..." : state.phase == "paused" ? "Paused by teacher" : apiStatus != "" ? "Waiting for classroom connection" : m.battleContinue?.supported == true ? "Click anywhere to continue | auto in " + Math.Ceiling(m.battleContinue.remainingMs / 1000) + "s" : !pageReadable ? "Auto-continue paused - return to the game window" : "Click anywhere to continue | auto in " + Math.Ceiling(Math.Max(0, 5 - revealTiming.Elapsed)) + "s", new GUIStyle(GUI.skin.label) { fontSize = 18, alignment = TextAnchor.MiddleCenter });
	}

	void SyncPresence(string phase, PresenceConfig config)
	{
#if UNITY_WEBGL && !UNITY_EDITOR
		HS_Presence(JsonUtility.ToJson(new PresenceSnapshot { phase = phase, presence = config }));
#else
		presence = "Playroom presence joins automatically in WebGL. Editor uses local authority.";
#endif
	}

	public void WakeRendering()
	{
		boostUntil = Time.unscaledTime + 1;
		Application.targetFrameRate = 24;
	}

	public void PresenceStatus(string value)
	{
		presence = value;
	}
}
