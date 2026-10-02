using System;
class PollActionGateVectors
{
 static void Check(bool value) { if(!value)throw new Exception("Poll/action gate failure"); }
 static void Main(){
 var gate=new PollActionGate<string>(); Check(!gate.BlocksInput);
 gate.Begin(true); Check(!gate.BlocksInput); Check(gate.Enqueue("swap")); Check(gate.BlocksInput); Check(!gate.Enqueue("duplicate"));
 gate.Complete();Check(gate.BlocksInput);Check(gate.Take()=="swap");Check(!gate.BlocksInput);
 gate.Begin(false);Check(gate.BlocksInput);Check(!gate.Enqueue("second write"));gate.Complete();Check(!gate.BlocksInput);
 for(int i=0;i<10;i++){gate.Begin(true);Check(!gate.BlocksInput);gate.Complete();Check(!gate.BlocksInput);}
 Console.WriteLine("PASS: read-only polls keep input enabled; one queued write, no duplicate or parallel writes");
 }
}
