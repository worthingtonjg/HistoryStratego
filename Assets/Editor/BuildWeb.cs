using System;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class BuildWeb
{
	[MenuItem("History Game/Build WebGL")]
	public static void Build()
	{
		PieceArtValidation.Validate();
		TabletopPreview.Render();
		System.IO.Directory.CreateDirectory("Assets/Scenes");
		var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
		new GameObject("HistoryGame").AddComponent<HistoryGame>();
		var camera = new GameObject("Camera").AddComponent<Camera>();
		camera.clearFlags = CameraClearFlags.SolidColor;
		camera.backgroundColor = new Color(.025f, .04f, .05f);
		EditorSceneManager.SaveScene(scene, "Assets/Scenes/Main.unity");
		PlayerSettings.companyName = "History Classroom";
		PlayerSettings.productName = "Civil War Hidden Orders";
		PlayerSettings.runInBackground = true;
		PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
		PlayerSettings.WebGL.template = "PROJECT:History";
		var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions { scenes = new[] { "Assets/Scenes/Main.unity" }, locationPathName = Environment.GetEnvironmentVariable("HISTORY_BUILD_OUTPUT") ?? "Builds/WebGL", target = BuildTarget.WebGL, options = BuildOptions.None });
		if (report.summary.result != BuildResult.Succeeded)
			throw new Exception("WebGL build failed: " + report.summary.result);
	}
}
