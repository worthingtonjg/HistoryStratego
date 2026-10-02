using UnityEditor;

// Keep source PNGs intact while limiting the WebGL texture footprint.
public class CommanderPortraitImport : AssetPostprocessor
{
	void OnPreprocessTexture()
	{
		if (!assetPath.StartsWith("Assets/Resources/CommanderPortraits/"))
			return;
		var texture = (TextureImporter)assetImporter;
		texture.textureType = TextureImporterType.Default;
		texture.maxTextureSize = 512;
		texture.mipmapEnabled = false;
		texture.isReadable = false;
		texture.textureCompression = TextureImporterCompression.Compressed;
		texture.alphaSource = TextureImporterAlphaSource.None;
	}
}
