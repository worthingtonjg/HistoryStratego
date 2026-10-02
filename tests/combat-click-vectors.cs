using System;

class CombatClickTests
{
	static void Check(bool value, string message)
	{
		if (!value)
			throw new Exception(message);
	}

	static void Main()
	{
		var gate = new CombatClickGate();
		gate.Observe("m:1", false);
		gate.Press(1, false);
		gate.Observe("m:1", true);
		Check(!gate.Release(true), "opening/held click cannot advance after timer");
		gate.Press(2, true);
		Check(!gate.Release(true), "double click rejected");
		gate.Press(1, true);
		Check(gate.Release(true), "fresh eligible click advances once");
		gate.Press(1, true);
		Check(!gate.Release(true), "no duplicate acknowledgment");
		gate.Observe("m:2", false);
		Check(!gate.Release(true), "new reveal requires new press");
		gate.Observe("m:2", true);
		gate.Press(1, true);
		gate.Observe("m:2", false);
		Check(!gate.Release(true), "ineligible transition clears held press");
		gate.Press(1, true);
		Check(!gate.Release(false), "outside viewport release ignored");
		gate.Press(1, true);
		Check(gate.Release(true), "normal click after rejected gesture");
		gate.Retry();
		Check(!gate.Release(true), "failed delivery never retries automatically");
		gate.Press(1, true);
		Check(gate.Release(true), "explicit retry allowed");
		Console.WriteLine("PASS fresh gesture, minimum boundary, identity, double click and explicit retry");
	}
}
