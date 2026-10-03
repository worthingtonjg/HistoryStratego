using System;
class FlagVectors {
 static void Check(bool v){if(!v)throw new Exception("Flag selection regression");}
 static void Main(){var a=new FlagEntrySelection();var f=new string[40];f[35]="F";Check(a.Select("m",0,1,false,true,f)==-1);Check(a.Select("m",0,1,true,false,f)==-1);Check(a.Select("m",0,1,true,true,f)==95);Check(a.Select("m",0,1,true,true,f)==-1);f[35]=null;f[3]="F";Check(a.Select("m",0,1,true,true,f)==-1);Check(a.Select("m",0,2,true,true,f)==-1);Check(a.Select("m",1,1,true,true,f)==36);Check(a.Select("next",0,1,true,true,f)==63);Check(new FlagEntrySelection().Select("m",0,1,true,true,f)==63);Check(new FlagEntrySelection().Select("m",0,2,true,true,f)==-1);Console.WriteLine("PASS once, both sides, polls, moved flag, reload, new match, phase two, intro and read-only");}
}
