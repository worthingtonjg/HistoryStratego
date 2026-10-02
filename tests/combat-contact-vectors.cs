using System;
class CombatContactTests {
 static void Check(bool ok,string message){if(!ok)throw new Exception(message);}
 static float Edge(float center,float angle,bool maximum){
  double a=angle*Math.PI/180,co=Math.Cos(a),si=Math.Sin(a);float result=maximum?float.MinValue:float.MaxValue;
  // Actual upright visible bounds: base, body, portrait face. All pivot heights are positive.
  float[,] boxes={{BattleMotion.BaseWidth/2,.03f,.17f},{.345f,.12f,.92f},{.295f,.175f,.865f}};
  for(int b=0;b<3;b++)for(int x=-1;x<=1;x+=2)for(int y=1;y<=2;y++){
   float v=center+(float)(x*boxes[b,0]*co-boxes[b,y]*si);result=maximum?Math.Max(result,v):Math.Min(result,v);
  }
  return result;
 }
 static void Main(){int checks=0;
  foreach(string rank in new[]{"1","2","3","4","5","6","7","8","9","10","B","F"})foreach(int outcome in new[]{-1,0,1})for(int frame=0;frame<=1000;frame++){
   float t=frame/1000f;var p=BattleMotion.At(rank,outcome,t);float gap=Edge(p.defenderX,p.defenderFall,false)-Edge(p.attackerX,p.attackerFall,true);
   Check(gap>=BattleMotion.ContactGap-.0001f,"intersection at "+rank+" outcome "+outcome+" t="+t+" gap="+gap);
   if(t<=.5f)Check(p.attackerFall==0&&p.defenderFall==0,"premature toppling");
   if(t==1){Check((p.attackerFall>0)==(outcome<=0),"attacker outcome");Check((p.defenderFall<0)==(outcome>=0),"defender outcome");}
   if(rank=="B"||rank=="F")Check(p.attackerX==-.85f,"immobile rank approached");checks++;
  }
  var hit=BattleMotion.At("6",1,.5f);Check(Math.Abs(hit.defenderX-hit.attackerX-BattleMotion.BaseWidth-BattleMotion.ContactGap)<.0001,"contact endpoint");
  Console.WriteLine("PASS "+checks+" sampled trajectory bounds, contact gap, special ranks and loser-only toppling");
 }
}
