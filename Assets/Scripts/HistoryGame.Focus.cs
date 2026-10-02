using System;
using System.Runtime.InteropServices;
using UnityEngine;

public partial class HistoryGame
{
    bool boardFocus, focusLegacyOverlay, focusMessages;
    Vector2 focusMenuScroll;
#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")] static extern void HS_FocusState(int available, int active);
#endif
    public void ToggleBoardFocus()
    {
        var m = teacherMode ? spectator?.match : StudentMatch();
        if (m == null || NeedsIntro(m)) return;
        boardFocus = !boardFocus; focusMessages = false; commanderOpen = false; presetMenuOpen = false;
        GUIUtility.hotControl = 0; WakeRendering();
    }
    Rect FocusBoardRect()
    {
        float size = Mathf.Min(Screen.width, Screen.height);
        return new Rect((Screen.width-size)/2, (Screen.height-size)/2, size, size);
    }
    GUIStyle FocusStyle(int size=20) => new GUIStyle(GUI.skin.label) {fontSize=size, wordWrap=true, alignment=TextAnchor.MiddleCenter};
    void FocusBackground(Rect rect)
    {
        GUI.color=new Color(.025f,.045f,.065f,1); GUI.DrawTexture(rect,Texture2D.whiteTexture); GUI.color=Color.white;
    }
    void FocusNotice(string title,string detail)
    {
        float width=Mathf.Min(Screen.width-24,640); var body=FocusStyle(21);
        float height=Mathf.Max(145,body.CalcHeight(new GUIContent(detail),width-28)+82);
        var rect=new Rect((Screen.width-width)/2,(Screen.height-height)/2,width,height);
        FocusBackground(rect);GUI.contentColor=accent;GUI.Label(new Rect(rect.x+12,rect.y+10,width-24,44),title,FocusStyle(25));GUI.contentColor=Color.white;
        GUI.Label(new Rect(rect.x+14,rect.y+59,width-28,height-65),detail,body);
    }
    void FocusLegacy(Action draw,bool battle=false)
    {
        var matrix=GUI.matrix;focusLegacyOverlay=true;
        float scale=battle?Mathf.Min((Screen.width-12)/865f,(Screen.height-126)/555f):Mathf.Min(Screen.width/1200f,Screen.height/900f);
        float width=battle?865:1200,height=battle?555:900;
        GUI.matrix=Matrix4x4.TRS(new Vector3((Screen.width-width*scale)/2-(battle?25*scale:0),(Screen.height-height*scale)/2-(battle?178*scale:0),0),Quaternion.identity,new Vector3(scale,scale,1));
        draw();GUI.matrix=matrix;focusLegacyOverlay=false;
    }
    void DrawBoardFocus(MatchView m)
    {
        GUI.matrix=Matrix4x4.identity;GUI.color=GUI.contentColor=GUI.backgroundColor=Color.white;GUI.enabled=true;
        GUI.skin.button.fontSize=18;GUI.skin.label.fontSize=20;GUI.skin.label.richText=false;GUI.skin.button.richText=false;
        float width=Screen.width,height=Screen.height,bottom=height-68;
        string phase=teacherMode?spectator.phase:state.phase;
        bool paused=phase=="paused", blocked=DeadlineBlocked(m), intro=NeedsIntro(m);
        bool editing=!teacherMode&&m.phase=="setup"&&!m.ready[m.side]&&phase=="active"&&(m.setup==null||SetupRemaining(m)>0);
        FocusBackground(new Rect(0,0,width,height));
        // Controls are processed before board/cutscene gestures, and their whole strips own input.
        var normalRect=new Rect(8,bottom,Mathf.Min(150,width*.34f),60);
        float x=normalRect.xMax+8,available=width-x-8;
        GUI.enabled=true;
        bool controlPointer=rawPointer.y>=bottom||rawPointer.y<66;
        var input=Event.current;var savedType=input.type;
        bool suppress=controlPointer||focusMessages||paused||blocked;
        if(suppress&&(input.isMouse||input.isKey||input.type==EventType.ScrollWheel))input.type=EventType.Ignore;
        if(!suppress&&!HandleTipInput())HandleCombatInput();
        DrawBoard(m,editing,teacherMode);
        if(suppress)input.type=savedType;
        FocusBackground(new Rect(0,bottom-4,width,66));
        if(GUI.Button(normalRect,"Normal view")){boardFocus=false;focusMessages=false;return;}
        GUI.enabled=!ActionBusy&&!paused&&!blocked;

        if(teacherMode){
            if(GUI.Button(new Rect(x,bottom,available,60),"Switch perspective")) Send("teacher/spectate",new Command{matchId=m.id,perspective=m.side==0?"blue":"red"});
        } else if(editing){
            float half=(available-8)/2;
            if(GUI.Button(new Rect(x,bottom,half,60),"Shuffle")) {
                if(m.setup!=null)Send("setup/shuffle",new Command{matchId=m.id,revision=m.setup.revision});
                else {formation=ArmyFormation.Generate();selected=-1;}
            }
            if(GUI.Button(new Rect(x+half+8,bottom,half,60),"Start Game"))Send("setup",new Command{matchId=m.id,revision=m.setup?.revision??0,ranks=m.setup==null?formation:null});
        } else if(m.phase=="play"||m.battle?.kind=="combat") {
            double remaining=Math.Max(0,m.emoteCooldownMs-(Time.unscaledTime-setupReceivedAt)*1000);
            GUI.enabled=GUI.enabled&&remaining<=0;
            if(GUI.Button(new Rect(x,bottom,available,60),remaining>0?"Messages "+Math.Ceiling(remaining/1000)+"s":focusMessages?"Close messages":"Messages"))focusMessages=!focusMessages;
        }
        GUI.enabled=true;
        FocusBackground(new Rect(0,0,width,66));
        string status=paused?"Paused by teacher":m.phase=="setup"?teacherMode?"Formation setup (read-only)":m.ready[m.side]?"Waiting for opponent formation":"Formation: "+Math.Ceiling(SetupRemaining(m)/1000)+"s":m.phase=="over"?"Match finished":(teacherMode?PlayerName(m,m.turn)+" to move":m.turn==m.side?"Your turn":PlayerName(m,m.turn)+" to move")+(m.turnClock?.enabled==true?" | "+Math.Ceiling(m.turnClock.remainingMs/1000)+"s":"");
        GUI.Label(new Rect(8,3,width-16,30),status,FocusStyle(21));
        GUI.Label(new Rect(8,33,width-16,30),apiStatus!=""?"Connection unavailable - waiting":teacherMode?"Read-only: "+SideName(m,m.side):editing?"Tap two pieces to swap":error!=""?error:SideName(m,m.side),FocusStyle(16));
        FocusLegacy(()=>DrawBattle(m,teacherMode),true);
        if(m.phase=="over"&&m.battle?.kind!="combat")FocusLegacy(()=>DrawEndgame(m,teacherMode));
        if(paused){focusMessages=false;FocusNotice("Paused by teacher","Please wait. Your game resumes when your teacher is ready.");}
        else if(blocked)FocusNotice("Time's up",m.setupBlocked?"Formation locked. Waiting for the setup notice to finish.":"An automatic legal move will be made. Please wait.");
        else if(tipVisible&&!teacherMode){FocusNotice("Strategy tip",BattleTips.Text(battleTips.Active)+"\nTap to dismiss.");if(input.type==EventType.Repaint)paintedTip=tipKey+":"+battleTips.Active;}
        else if(reminderVisible&&!teacherMode&&m.phase=="play"&&m.battle?.kind!="combat")FocusNotice("Your turn",ReadableTiming.Reminder(reminderKey));
        if(!paused&&!blocked)DrawPresetNotification(m);
        if(focusMessages&&!paused&&!blocked&&!teacherMode){
            float menuWidth=Mathf.Min(width-24,480),row=60,menuHeight=Mathf.Min(height-150,row*6+12);
            var menu=new Rect((width-menuWidth)/2,Mathf.Max(68,bottom-menuHeight-6),menuWidth,menuHeight);FocusBackground(menu);
            GUI.enabled=!ActionBusy;
            focusMenuScroll=GUI.BeginScrollView(new Rect(menu.x+6,menu.y+6,menu.width-12,menu.height-12),focusMenuScroll,new Rect(0,0,menu.width-32,row*6));
            for(int i=0;i<presetKeys.Length;i++)if(GUI.Button(new Rect(0,i*row,menu.width-32,row-4),presetLabels[i])){focusMessages=false;Send("emote",new Command{matchId=m.id,emoteId=presetKeys[i]});break;}
            GUI.EndScrollView();
            GUI.enabled=true;
            if(menu.Contains(rawPointer)&&(input.isMouse||input.type==EventType.ScrollWheel))input.Use();
        }
    }
    void DrawFocusMessage(MatchView m,EmoteView message,string name)
    {
        var rect=new Rect(12,72,Screen.width-24,96);FocusBackground(rect);
        var commander=m.commanders!=null&&message.side<m.commanders.Length?m.commanders[message.side]:null;
        var portrait=commander!=null?CommanderPortrait(commander.id):null;
        if(portrait!=null)GUI.DrawTexture(new Rect(20,80,64,64),portrait,ScaleMode.ScaleToFit);
        GUI.Label(new Rect(92,77,Screen.width-116,34),name,FocusStyle(16));
        GUI.Label(new Rect(92,110,Screen.width-116,50),message.text,FocusStyle(19));
    }
}
