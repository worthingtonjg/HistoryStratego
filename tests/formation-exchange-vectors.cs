using System;
class FormationExchangeVectors
{
 static void Check(bool x) { if (!x) throw new Exception("Formation exchange validation failed"); }
 static void Main() {
  var before=new string[40]; for(int i=0;i<40;i++)before[i]=i.ToString();
  var after=(string[])before.Clone(); after[2]=before[33];after[33]=before[2];
  Check(FormationExchange.Confirmed(before,after,2,33,4,5));
  Check(!FormationExchange.Confirmed(before,after,2,33,4,4));
  Check(!FormationExchange.Confirmed(before,after,2,33,4,6));
  Check(!FormationExchange.Confirmed(before,after,-1,33,4,5));
  Check(!FormationExchange.Confirmed(before,after,2,2,4,5));
  after[15]="different";Check(!FormationExchange.Confirmed(before,after,2,33,4,5));
  before[2]=before[33];Check(FormationExchange.Confirmed(before,(string[])before.Clone(),2,33,4,5));
  Check(!FormationExchange.Confirmed(null,after,2,33,4,5));Console.WriteLine("PASS");
 }
}