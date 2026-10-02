Shader "History/LakeWater" {
 Properties { _MainTex("Water bed",2D)="white"{} _Unlit("Unlit",Float)=1 }
 SubShader { Tags { "RenderType"="Opaque" } Pass {
 CGPROGRAM
 #pragma vertex vert
 #pragma fragment frag
 #include "UnityCG.cginc"
 sampler2D _MainTex;
 struct appdata { float4 vertex:POSITION; float2 uv:TEXCOORD0; };
 struct v2f { float4 vertex:SV_POSITION; float2 uv:TEXCOORD0; float2 world:TEXCOORD1; };
 v2f vert(appdata v){v2f o;o.vertex=UnityObjectToClipPos(v.vertex);o.uv=v.uv;o.world=mul(unity_ObjectToWorld,v.vertex).xz;return o;}
 fixed4 frag(v2f i):SV_Target {
   float t=_Time.y*.65;
   float wave=sin(i.world.x*12+i.world.y*9+t*2)+.45*sin(i.world.y*19-i.world.x*5-t);
   float glint=smoothstep(.9,1.4,wave)*.055;
   fixed3 water=tex2D(_MainTex,i.uv).rgb;
   return fixed4(water+wave*.012+glint*fixed3(.65,.9,1),1);
 }
 ENDCG
 } }
 Fallback "History/Tabletop"
}
