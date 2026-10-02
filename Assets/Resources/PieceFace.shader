Shader "History/PieceFace" {
 Properties { _MainTex("Sample artwork",2D)="white"{} _ArtBottom("Artwork bottom margin",Float)=0.08 _Backing("Faction backing",Color)=(.5,.68,.79,1) _Concealed("Hidden rank",Float)=0 }
 SubShader { Tags { "RenderType"="Opaque" "DisableBatching"="True" } Pass {
 CGPROGRAM
 #pragma vertex vert
 #pragma fragment frag
 #include "UnityCG.cginc"
 sampler2D _MainTex; float _ArtBottom; fixed4 _Backing; float _Concealed;
 struct appdata { float4 vertex:POSITION; float3 normal:NORMAL; float2 uv:TEXCOORD0; };
 struct v2f { float4 vertex:SV_POSITION; float2 uv:TEXCOORD0; float faceZ:TEXCOORD1; };
 v2f vert(appdata v){v2f o;o.vertex=UnityObjectToClipPos(v.vertex);o.uv=v.uv;o.faceZ=v.normal.z;return o;}
 fixed4 frag(v2f i):SV_Target {
   float2 uv=float2((1-i.uv.x-.04)/.92,(1-i.uv.y-_ArtBottom)/.84);
   fixed3 paper=_Backing.rgb;
   if(_Concealed>.5){float2 p=i.uv-.5;float mark=i.faceZ<-.5?step(abs(p.x)+abs(p.y),.14):0;return fixed4(lerp(paper,fixed3(.94,.9,.76),mark),1);}
   if(i.faceZ>-.5||any(uv<0)||any(uv>1))return fixed4(paper,1);
   fixed4 art=tex2D(_MainTex,uv);
   return fixed4(lerp(paper,art.rgb,art.a),1);
 }
 ENDCG
 } }
 Fallback "History/Tabletop"
}
