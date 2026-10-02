public static class TeacherActionPolicy
{
	public static bool Visible(string action, string phase, int connectedSide0, int connectedSide1, bool hasMatches)
	{
		bool ready = (phase == "waiting" || phase == "ended") && connectedSide0 > 0 && connectedSide1 > 0;
		if (action == "randomize" || action == "start")
			return ready;
		if (action == "pause")
			return phase == "active" && hasMatches;
		if (action == "resume")
			return phase == "paused" && hasMatches;
		if (action == "end")
			return phase == "active" || phase == "paused";
		return false;
	}
}
