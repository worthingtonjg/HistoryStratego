using UnityEngine;

public partial class HistoryGame
{
    bool TopNoticeVisible => !teacherMode && state?.phase != "paused" && (tipVisible || (reminderVisible && Time.unscaledTime-turnNoticeStart>=2));
    bool FriendlyMessageVisible()
    {
        var m=teacherMode?spectator?.match:StudentMatch();
        if(m==null||DeadlineBlocked(m)||commanderOpen||(m.phase!="play"&&m.battle?.kind!="combat"))return false;
        foreach(var e in m.emotes??System.Array.Empty<EmoteView>())
            if(e.side>=0&&e.side<2&&e.remainingMs>0&&(presetMatch!=m.id||presetSeen[e.side]!=e.issuedAt||Time.unscaledTime<presetUntil[e.side]))return true;
        return false;
    }
    Rect TopMessageRect(bool friendly)
    {
        bool both=TopNoticeVisible&&FriendlyMessageVisible();
        if(!boardFocus)return both?new Rect(friendly?737:285,18,438,128):new Rect(285,18,890,128);
        if(both&&Screen.width>=650)return new Rect(friendly?Screen.width/2+4:12,72,Screen.width/2-16,128);
        return new Rect(12,friendly&&both?208:72,Screen.width-24,128);
    }
    void DrawTopNotice(string title,string message,string footer)
    {
        var rect=TopMessageRect(false);FocusBackground(rect);
        GUI.contentColor=accent;
        GUI.Label(new Rect(rect.x+12,rect.y+6,rect.width-24,24),title,new GUIStyle(GUI.skin.label){fontSize=16,fontStyle=FontStyle.Bold,alignment=TextAnchor.MiddleCenter});
        GUI.contentColor=Color.white;
        var body=new GUIStyle(GUI.skin.label){fontSize=24,wordWrap=true,alignment=TextAnchor.MiddleCenter};
        float height=footer==""?88:70;
        while(body.fontSize>14&&body.CalcHeight(new GUIContent(message),rect.width-28)>height)body.fontSize--;
        GUI.Label(new Rect(rect.x+14,rect.y+31,rect.width-28,height),message,body);
        if(footer!="")GUI.Label(new Rect(rect.x+10,rect.y+108,rect.width-20,18),footer,new GUIStyle(GUI.skin.label){fontSize=12,alignment=TextAnchor.MiddleCenter});
    }
}
