using System;

class CaptionTests
{
	static void Check(string a, string d, int o, string expected)
	{
		string actual = BattleCaption.Describe("Alex", "Sam", a, d, o);
		if (actual != expected)
			throw new Exception(actual);
	}

	static void Main()
	{
		Check("10", "2", 1, "Alex's Marshal defeats Sam's Scout.");
		Check("2", "10", -1, "Sam's Marshal defeats Alex's Scout.");
		Check("2", "2", 0, "Alex's Scout and Sam's Scout eliminate each other.");
		Check("3", "B", 1, "Alex's Miner disarms Sam's Bomb.");
		Check("10", "B", -1, "Sam's Bomb stops Alex's Marshal.");
		Check("1", "10", 1, "Alex's Spy defeats Sam's Marshal.");
		Check("10", "1", 1, "Alex's Marshal defeats Sam's Spy.");
		Check("2", "F", 1, "Alex's Scout captures Sam's Flag.");
		if (BattleCaption.Describe("James", "Chris", "2", "2", 0) != "James' Scout and Chris' Scout eliminate each other.")
			throw new Exception("possessives");
		Console.WriteLine("PASS exact named captions and possessives");
	}
}
