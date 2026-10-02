public static class PieceArtResources
{
	public static string Key(string rank)
	{
		switch (rank)
		{
			case "10":
				return "PieceArt/marshal";
			case "9":
				return "PieceArt/general";
			case "8":
				return "PieceArt/colonel";
			case "7":
				return "PieceArt/major";
			case "6":
				return "PieceArt/captain";
			case "5":
				return "PieceArt/lieutenant";
			case "4":
				return "PieceArt/sergeant";
			case "3":
				return "PieceArt/miner";
			case "2":
				return "PieceArt/scout";
			case "1":
				return "PieceArt/spy";
			case "B":
				return "PieceArt/bomb";
			case "F":
				return "PieceArt/flag";
			default:
				return null;
		}
	}
}
