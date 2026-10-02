using System;

class FormationVectors
{
	static void Main()
	{
		for (uint seed = 0; seed < 256; seed++)
			Console.WriteLine(string.Join(",", ArmyFormation.Generate(seed * 2654435761u)));
	}
}
