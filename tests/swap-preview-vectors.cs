using System;
class SwapPreviewVectors {
 static void Check(bool v){if(!v)throw new Exception("preview reconciliation failure");}
 static void Main(){
 var before=new string[40];for(int i=0;i<40;i++)before[i]=i.ToString();var after=(string[])before.Clone();after[1]=before[20];after[20]=before[1];
 var p=new FormationSwapPreview(before,1,20,5,10);Check(p.Pending&&p.BlocksInput(10));Check(p.Progress(10)==0);Check(p.Progress(10.2f)>0);Check(p.Progress(11)==1&&p.BlocksInput(11));
 p.Observe(before,5,true);Check(p.Active&&p.Pending);p.Observe(after,6,true);Check(p.Active&&!p.Pending&&!p.BlocksInput(11));Check(p.Started==10);
 p=new FormationSwapPreview(before,1,20,5,10);p.Observe(after,6,true);Check(p.BlocksInput(10.1f));p.Cancel();Check(!p.Active&&!p.BlocksInput(10.1f));
 foreach(var revision in new[]{4,7}){p=new FormationSwapPreview(before,1,20,5,10);p.Observe(after,revision,true);Check(!p.Active);}
 p=new FormationSwapPreview(before,1,20,5,10);p.Observe(before,5,false);Check(!p.Active);
 p=new FormationSwapPreview(before,1,20,5,10);p.Observe(before,6,true);Check(!p.Active);
 p=new FormationSwapPreview(before,1,20,5,10);p.Observe(null,5,true);Check(!p.Active);
 Console.WriteLine("PASS");
 }
}