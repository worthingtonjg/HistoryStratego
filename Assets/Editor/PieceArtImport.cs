using UnityEditor;

// Preserve the supplied cutout alpha; commander portrait import defaults are not suitable.
public sealed class PieceArtImport : AssetPostprocessor
{
	void OnPreprocessTexture()
	{
		if (!assetPath.StartsWith("Assets/Resources/PieceArt/"))
			return;
		var importer = (TextureImporter)assetImporter;
		importer.textureType = TextureImporterType.Default;
		importer.alphaSource = TextureImporterAlphaSource.FromInput;
		importer.alphaIsTransparency = true;
		importer.mipmapEnabled = false;
		importer.maxTextureSize = 512;
		importer.textureCompression = TextureImporterCompression.Uncompressed;
		var platform = importer.GetPlatformTextureSettings("WebGL");
		platform.name = "WebGL";
		platform.overridden = true;
		platform.maxTextureSize = 512;
		platform.format = TextureImporterFormat.RGBA32;
		platform.textureCompression = TextureImporterCompression.Uncompressed;
		importer.SetPlatformTextureSettings(platform);
	}
}
