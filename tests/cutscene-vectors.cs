using System;

class CutsceneTests
{
	static void Check(bool b, string m)
	{
		if (!b)
			throw new Exception(m);
	}

	static void Main()
	{
		Check(CutscenePresentation.Speaker("The board just got a little roomier.", "8", "4", 1, "Alex") == "Alex's Colonel", "winner speaker");
		Check(CutscenePresentation.Speaker("Upper management has concluded this meeting.", "2", "10", -1, "James") == "James' Marshal", "defender speaker");
		foreach (var q in new[]
		{
			"The board just got a little roomier.",
			"That square had a strict no-visitors policy.",
			"The surprise party has officially been canceled."
		}

		)
		{
			Check(CutscenePresentation.Speaker(q, "3", "B", 1, "Alex") == "", "bomb narrator");
			Check(CutscenePresentation.Speaker(q, "2", "2", 0, "Sam") == "", "tie narrator");
		}

		Check(CutscenePresentation.Speaker("Excellent with obstacles. Less lucky this round.", "3", "4", -1, "Sam") == "Sam's Sgt", "all ordinary survivor lines attributed");
		Check(CutscenePresentation.Speaker("Any stable quote", "1", "10", 1, "Pickett") == "Pickett's Spy", "attacking spy winner");
		Check(CutscenePresentation.Speaker("Any stable quote", "2", "F", 1, "Burnside") == "Burnside's Scout", "flag capture winner");
		Check(CutscenePresentation.Speaker("Any stable quote", "10", "B", -1, "Pickett") == "", "bomb winner exception");
		Console.WriteLine("PASS appropriate winner attribution and narrator exceptions");
	}
}
