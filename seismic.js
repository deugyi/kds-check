/* KDS 41 17 00:2022 — spectrum, equivalent-static base shear and RSA scaling.
 * Units: m, seconds, kN; accelerations are fractions of g. No mass-to-weight conversion. */
(function(root){
'use strict';
const SYSTEMS=[
  {
    "id": "1-a",
    "name": "철근콘크리트 특수전단벽",
    "group": "1. 내력벽시스템",
    "R": 5.0,
    "omega": 2.5,
    "Cd": 5.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "1-b",
    "name": "철근콘크리트 보통전단벽",
    "group": "1. 내력벽시스템",
    "R": 4.0,
    "omega": 2.5,
    "Cd": 4.0,
    "limits": [
      null,
      null,
      60.0
    ]
  },
  {
    "id": "1-c",
    "name": "철근보강 조적 전단벽",
    "group": "1. 내력벽시스템",
    "R": 2.5,
    "omega": 2.5,
    "Cd": 1.5,
    "limits": [
      null,
      60.0,
      "prohibited"
    ]
  },
  {
    "id": "1-d",
    "name": "무보강 조적 전단벽",
    "group": "1. 내력벽시스템",
    "R": 1.5,
    "omega": 2.5,
    "Cd": 1.5,
    "limits": [
      null,
      "prohibited",
      "prohibited"
    ]
  },
  {
    "id": "1-e",
    "name": "구조용 목재패널을 덧댄 경골목구조 전단벽",
    "group": "1. 내력벽시스템",
    "R": 6.0,
    "omega": 3.0,
    "Cd": 4.0,
    "limits": [
      null,
      20.0,
      20.0
    ]
  },
  {
    "id": "1-f",
    "name": "구조용 목재패널 또는 강판시트를 덧댄 경량철골조 전단벽",
    "group": "1. 내력벽시스템",
    "R": 6.0,
    "omega": 3.0,
    "Cd": 4.0,
    "limits": [
      null,
      20.0,
      20.0
    ]
  },
  {
    "id": "2-a",
    "name": "철골 편심가새골조 (링크 타단 모멘트 저항 접합)",
    "group": "2. 건물골조시스템",
    "R": 8.0,
    "omega": 2.0,
    "Cd": 4.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "2-b",
    "name": "철골 편심가새골조 (링크 타단 비모멘트 저항접합)",
    "group": "2. 건물골조시스템",
    "R": 7.0,
    "omega": 2.0,
    "Cd": 4.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "2-c",
    "name": "철골 특수중심가새골조",
    "group": "2. 건물골조시스템",
    "R": 6.0,
    "omega": 2.0,
    "Cd": 5.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "2-d",
    "name": "철골 보통중심가새골조",
    "group": "2. 건물골조시스템",
    "R": 3.25,
    "omega": 2.0,
    "Cd": 3.25,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "2-e",
    "name": "합성 편심가새골조",
    "group": "2. 건물골조시스템",
    "R": 8.0,
    "omega": 2.0,
    "Cd": 4.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "2-f",
    "name": "합성 특수중심가새골조",
    "group": "2. 건물골조시스템",
    "R": 5.0,
    "omega": 2.0,
    "Cd": 4.5,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "2-g",
    "name": "합성 보통중심가새골조",
    "group": "2. 건물골조시스템",
    "R": 3.0,
    "omega": 2.0,
    "Cd": 3.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "2-h",
    "name": "합성 강판전단벽",
    "group": "2. 건물골조시스템",
    "R": 6.5,
    "omega": 2.5,
    "Cd": 5.5,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "2-i",
    "name": "합성 특수전단벽",
    "group": "2. 건물골조시스템",
    "R": 6.0,
    "omega": 2.5,
    "Cd": 5.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "2-j",
    "name": "합성 보통전단벽",
    "group": "2. 건물골조시스템",
    "R": 5.0,
    "omega": 2.5,
    "Cd": 4.5,
    "limits": [
      null,
      null,
      60.0
    ]
  },
  {
    "id": "2-k",
    "name": "철골 특수강판전단벽",
    "group": "2. 건물골조시스템",
    "R": 7.0,
    "omega": 2.0,
    "Cd": 6.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "2-l",
    "name": "철골 좌굴방지가새골조 (모멘트 저항 접합)",
    "group": "2. 건물골조시스템",
    "R": 8.0,
    "omega": 2.5,
    "Cd": 5.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "2-m",
    "name": "철골 좌굴방지가새골조 (비모멘트 저항 접합)",
    "group": "2. 건물골조시스템",
    "R": 7.0,
    "omega": 2.0,
    "Cd": 5.5,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "2-n",
    "name": "철근콘크리트 특수전단벽",
    "group": "2. 건물골조시스템",
    "R": 6.0,
    "omega": 2.5,
    "Cd": 5.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "2-o",
    "name": "철근콘크리트 보통전단벽",
    "group": "2. 건물골조시스템",
    "R": 5.0,
    "omega": 2.5,
    "Cd": 4.5,
    "limits": [
      null,
      null,
      60.0
    ]
  },
  {
    "id": "2-p",
    "name": "철근보강 조적 전단벽",
    "group": "2. 건물골조시스템",
    "R": 3.0,
    "omega": 2.5,
    "Cd": 2.0,
    "limits": [
      null,
      60.0,
      "prohibited"
    ]
  },
  {
    "id": "2-q",
    "name": "무보강 조적 전단벽",
    "group": "2. 건물골조시스템",
    "R": 1.5,
    "omega": 2.5,
    "Cd": 1.5,
    "limits": [
      null,
      "prohibited",
      "prohibited"
    ]
  },
  {
    "id": "2-r",
    "name": "구조용 목조패널을 덧댄 경골목구조 전단벽",
    "group": "2. 건물골조시스템",
    "R": 6.5,
    "omega": 2.5,
    "Cd": 4.5,
    "limits": [
      null,
      20.0,
      20.0
    ]
  },
  {
    "id": "2-s",
    "name": "구조용 목재패널 또는 강판시트를 덧댄 경량철골조 전단벽",
    "group": "2. 건물골조시스템",
    "R": 6.5,
    "omega": 2.5,
    "Cd": 4.5,
    "limits": [
      null,
      20.0,
      20.0
    ]
  },
  {
    "id": "3-a",
    "name": "철골 특수모멘트골조",
    "group": "3. 모멘트－저항골조 시스템",
    "R": 8.0,
    "omega": 3.0,
    "Cd": 5.5,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "3-b",
    "name": "철골 중간모멘트골조",
    "group": "3. 모멘트－저항골조 시스템",
    "R": 4.5,
    "omega": 3.0,
    "Cd": 4.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "3-c",
    "name": "철골 보통모멘트골조",
    "group": "3. 모멘트－저항골조 시스템",
    "R": 3.5,
    "omega": 3.0,
    "Cd": 3.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "3-d",
    "name": "합성 특수모멘트골조",
    "group": "3. 모멘트－저항골조 시스템",
    "R": 8.0,
    "omega": 3.0,
    "Cd": 5.5,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "3-e",
    "name": "합성 중간모멘트골조",
    "group": "3. 모멘트－저항골조 시스템",
    "R": 5.0,
    "omega": 3.0,
    "Cd": 4.5,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "3-f",
    "name": "합성 보통모멘트골조",
    "group": "3. 모멘트－저항골조 시스템",
    "R": 3.0,
    "omega": 3.0,
    "Cd": 2.5,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "3-g",
    "name": "합성 반강접모멘트골조",
    "group": "3. 모멘트－저항골조 시스템",
    "R": 6.0,
    "omega": 3.0,
    "Cd": 5.5,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "3-h",
    "name": "철근콘크리트 특수모멘트골조",
    "group": "3. 모멘트－저항골조 시스템",
    "R": 8.0,
    "omega": 3.0,
    "Cd": 5.5,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "3-i",
    "name": "철근콘크리트 중간모멘트골조",
    "group": "3. 모멘트－저항골조 시스템",
    "R": 5.0,
    "omega": 3.0,
    "Cd": 4.5,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "3-j",
    "name": "철근콘크리트 보통모멘트골조",
    "group": "3. 모멘트－저항골조 시스템",
    "R": 3.0,
    "omega": 3.0,
    "Cd": 2.5,
    "limits": [
      null,
      null,
      30.0
    ]
  },
  {
    "id": "4-a",
    "name": "철골 편심가새골조",
    "group": "4. 특수모멘트골조를 가진 이중골조시스템",
    "R": 8.0,
    "omega": 2.5,
    "Cd": 4.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "4-b",
    "name": "철골 특수중심가새골조",
    "group": "4. 특수모멘트골조를 가진 이중골조시스템",
    "R": 7.0,
    "omega": 2.5,
    "Cd": 5.5,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "4-c",
    "name": "합성 편심가새골조",
    "group": "4. 특수모멘트골조를 가진 이중골조시스템",
    "R": 8.0,
    "omega": 2.5,
    "Cd": 4.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "4-d",
    "name": "합성 특수중심가새골조",
    "group": "4. 특수모멘트골조를 가진 이중골조시스템",
    "R": 6.0,
    "omega": 2.5,
    "Cd": 5.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "4-e",
    "name": "합성 강판전단벽",
    "group": "4. 특수모멘트골조를 가진 이중골조시스템",
    "R": 7.5,
    "omega": 2.5,
    "Cd": 6.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "4-f",
    "name": "합성 특수전단벽",
    "group": "4. 특수모멘트골조를 가진 이중골조시스템",
    "R": 7.0,
    "omega": 2.5,
    "Cd": 6.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "4-g",
    "name": "합성 보통전단벽",
    "group": "4. 특수모멘트골조를 가진 이중골조시스템",
    "R": 6.0,
    "omega": 2.5,
    "Cd": 5.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "4-h",
    "name": "철골 좌굴방지가새골조",
    "group": "4. 특수모멘트골조를 가진 이중골조시스템",
    "R": 8.0,
    "omega": 2.5,
    "Cd": 5.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "4-i",
    "name": "철골 특수강판전단벽",
    "group": "4. 특수모멘트골조를 가진 이중골조시스템",
    "R": 8.0,
    "omega": 2.5,
    "Cd": 6.5,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "4-j",
    "name": "철근콘크리트 특수전단벽",
    "group": "4. 특수모멘트골조를 가진 이중골조시스템",
    "R": 7.0,
    "omega": 2.5,
    "Cd": 5.5,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "4-k",
    "name": "철근콘크리트 보통전단벽",
    "group": "4. 특수모멘트골조를 가진 이중골조시스템",
    "R": 6.0,
    "omega": 2.5,
    "Cd": 5.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "5-a",
    "name": "철골 특수중심가새골조",
    "group": "5. 중간모멘트골조를 가진 이중골조시스템",
    "R": 6.0,
    "omega": 2.5,
    "Cd": 5.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "5-b",
    "name": "철근콘크리트 특수전단벽",
    "group": "5. 중간모멘트골조를 가진 이중골조시스템",
    "R": 6.5,
    "omega": 2.5,
    "Cd": 5.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "5-c",
    "name": "철근콘크리트 보통전단벽",
    "group": "5. 중간모멘트골조를 가진 이중골조시스템",
    "R": 5.5,
    "omega": 2.5,
    "Cd": 4.5,
    "limits": [
      null,
      null,
      60.0
    ]
  },
  {
    "id": "5-d",
    "name": "합성 특수중심가새골조",
    "group": "5. 중간모멘트골조를 가진 이중골조시스템",
    "R": 5.5,
    "omega": 2.5,
    "Cd": 4.5,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "5-e",
    "name": "합성 보통중심가새골조",
    "group": "5. 중간모멘트골조를 가진 이중골조시스템",
    "R": 3.5,
    "omega": 2.5,
    "Cd": 3.0,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "5-f",
    "name": "합성 보통전단벽",
    "group": "5. 중간모멘트골조를 가진 이중골조시스템",
    "R": 5.0,
    "omega": 3.0,
    "Cd": 4.5,
    "limits": [
      null,
      null,
      60.0
    ]
  },
  {
    "id": "5-g",
    "name": "철근보강 조적 전단벽",
    "group": "5. 중간모멘트골조를 가진 이중골조시스템",
    "R": 3,
    "omega": 3,
    "Cd": 2.5,
    "limits": [
      null,
      60,
      "prohibited"
    ]
  },
  {
    "id": "6-a",
    "name": "캔틸레버 기둥 시스템",
    "group": "6. 역추형 시스템",
    "R": 2.5,
    "omega": 2.0,
    "Cd": 2.5,
    "limits": [
      null,
      null,
      10.0
    ]
  },
  {
    "id": "6-b",
    "name": "철골 특수모멘트골조",
    "group": "6. 역추형 시스템",
    "R": 2.5,
    "omega": 2.0,
    "Cd": 2.5,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "6-c",
    "name": "철골 보통모멘트골조",
    "group": "6. 역추형 시스템",
    "R": 1.25,
    "omega": 2.0,
    "Cd": 2.5,
    "limits": [
      null,
      null,
      "prohibited"
    ]
  },
  {
    "id": "6-d",
    "name": "철근콘크리트 특수모멘트골조",
    "group": "6. 역추형 시스템",
    "R": 2.5,
    "omega": 2.0,
    "Cd": 1.25,
    "limits": [
      null,
      null,
      null
    ]
  },
  {
    "id": "7",
    "name": "철근콘크리트 보통 전단벽－골조 상호작용 시스템",
    "group": "기타 시스템",
    "R": 4.5,
    "omega": 2.5,
    "Cd": 4.0,
    "limits": [
      null,
      null,
      60.0
    ]
  },
  {
    "id": "8",
    "name": "6의 역추형 시스템에 속하지 않으면서 강구조기준의 일반규정만을 만족하는 철골구조시스템",
    "group": "기타 시스템",
    "R": 3.0,
    "omega": 3.0,
    "Cd": 3.0,
    "limits": [
      null,
      null,
      60.0
    ]
  },
  {
    "id": "9",
    "name": "6의 역추형시스템에 속하지 않으면서 철근콘크리트구조기준의 일반규정만을 만족하는 철근콘크리트구조 시스템",
    "group": "기타 시스템",
    "R": 3.0,
    "omega": 3.0,
    "Cd": 3.0,
    "limits": [
      null,
      null,
      30.0
    ]
  }
];
const SOILS={S1:{name:'암반 지반',Fa:[1.12,1.12,1.12],Fv:[.84,.84,.84]},S2:{name:'얕고 단단한 지반',Fa:[1.4,1.4,1.3],Fv:[1.5,1.4,1.3]},S3:{name:'얕고 연약한 지반',Fa:[1.7,1.5,1.3],Fv:[1.7,1.6,1.5]},S4:{name:'깊고 단단한 지반',Fa:[1.6,1.4,1.2],Fv:[2.2,2,1.8]},S5:{name:'깊고 연약한 지반',Fa:[1.8,1.3,1.3],Fv:[3,2.7,2.4]}};
const PERIODS={rc:{name:'철근콘크리트 모멘트골조',Ct:.0466,x:.9},steel:{name:'철골 모멘트골조',Ct:.0724,x:.8},brace:{name:'철골 편심·좌굴방지가새골조',Ct:.0731,x:.75},other:{name:'RC 전단벽구조 · 기타골조',Ct:.0488,x:.75}};
function interpolate(x,points){if(x<=points[0][0])return points[0][1];for(let i=1;i<points.length;i++){const [b,yb]=points[i],[a,ya]=points[i-1];if(x<=b)return ya+(yb-ya)*(x-a)/(b-a);}return points[points.length-1][1];}
function category(sds,sd1,importance){
 const rank=(v,a,b,c)=>v>=c?3:v>=b?(importance==='special'?3:2):v>=a?(importance==='special'?2:1):0;
 const ds=rank(sds,.17,.33,.5),d1=rank(sd1,.07,.14,.2);return {sds:'ABCD'[ds],sd1:'ABCD'[d1],governing:'ABCD'[Math.max(ds,d1)]};
}
function spectrum(T,r){if(!Number.isFinite(T)||T<0)throw Error('주기는 0 이상이어야 합니다.');if(T<=r.T0)return r.SDS*(.4+.6*T/r.T0);if(T<=r.Ts)return r.SDS;if(T<=5)return r.SD1/T;return r.SD1*5/T**2;}
function validate(p){
 const e=[],positive=(k,label)=>{if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<=0)e.push(label+'은 0보다 큰 수를 입력하세요.');};
 if(!['I','II'].includes(p.zone))e.push('지진구역을 선택하세요.');
 if(!['zone','map'].includes(p.hazardMode))e.push('유효지반가속도 산정 방식을 선택하세요.');
 if(p.hazardMode==='map'){positive('mapS','지진위험지도 S');if(p.mapS>.3)e.push('S > 0.3은 지반증폭계수 표의 범위를 벗어나므로 별도 검토가 필요합니다.');}
 if(!SOILS[p.soil])e.push('S1~S5 지반을 선택하세요. S6은 부지고유 지반응답해석이 필요합니다.');
 if(!['known','unknown'].includes(p.depthMode))e.push('기반암 깊이 확인 여부를 선택하세요.');
 if(p.depthMode==='known'){if(!Number.isFinite(p.depth)||p.depth<0)e.push('기반암 깊이는 0 이상이어야 합니다.');positive('vs','평균 전단파속도');}
 if(!['special','I','II'].includes(p.importance))e.push('내진등급을 선택하세요.');
 positive('height','건물 높이');positive('weight','유효건물중량 W');
 if(typeof p.correction!=='boolean')e.push('동적해석 보정 여부를 선택하세요.');
 for(const axis of ['x','y']){
  const a=p[axis]||{};
  if(!SYSTEMS.some(s=>s.id===a.system))e.push(axis.toUpperCase()+' 방향 저항시스템을 선택하세요.');
  if(!PERIODS[a.periodType])e.push(axis.toUpperCase()+' 방향 약산주기식을 선택하세요.');
  if(!['approx','analysis'].includes(a.periodMode))e.push(axis.toUpperCase()+' 방향 주기 산정법을 선택하세요.');
  if(a.periodMode==='analysis'&&(!Number.isFinite(a.period)||a.period<=0))e.push(axis.toUpperCase()+' 방향 해석주기는 0보다 커야 합니다.');
  if(p.correction&&(!Number.isFinite(a.Vt)||a.Vt<=0))e.push(axis.toUpperCase()+' 방향 동적 밑면전단력은 0보다 커야 합니다.');
 }
 return e;
}
function calculate(p){
 const errors=validate(p);if(errors.length)return {valid:false,errors};
 const Z=p.zone==='I'?.11:.07,zoneS=2*Z,S=p.hazardMode==='map'?Math.max(.8*zoneS,p.mapS):zoneS;
 const soil=SOILS[p.soil],baseFa=interpolate(S,soil.Fa.map((v,i)=>[.1*(i+1),v])),baseFv=interpolate(S,soil.Fv.map((v,i)=>[.1*(i+1),v]));
 const reduce=p.depthMode==='known'&&p.depth>20&&p.vs>=360,amplify=p.soil==='S5'&&p.depthMode==='unknown';
 const Fa=baseFa*(amplify?1.1:1),Fv=baseFv*(reduce?.8:1)*(amplify?1.1:1);
 const SDS=S*2.5*Fa*2/3,SD1=S*Fv*2/3,T0=.2*SD1/SDS,Ts=SD1/SDS,IE={special:1.5,I:1.2,II:1}[p.importance];
 const cats=category(SDS,SD1,p.importance),Cu=interpolate(SD1,[[.1,1.7],[.15,1.6],[.2,1.5],[.3,1.4],[.4,1.4]]);
 const r={valid:true,errors:[],Z,zoneS,S,Fa,Fv,baseFa,baseFv,reduce,amplify,SDS,SD1,T0,Ts,TL:5,IE,Cu,categories:cats};
 for(const axis of ['x','y']){
  const a=p[axis],system=SYSTEMS.find(s=>s.id===a.system),q=PERIODS[a.periodType];
  const infill=!!a.infill&&['rc','steel'].includes(a.periodType),Ta=q.Ct*p.height**q.x*(infill?2/3:1),cap=Cu*Ta;
  const T=a.periodMode==='analysis'?Math.min(a.period,cap):Ta;
  const plateau=SDS*IE/system.R,periodTerm=SD1*IE/system.R*(T<=5?1/T:5/T**2),minimum=Math.max(.044*SDS*IE,.01),Cs=Math.max(minimum,Math.min(plateau,periodTerm)),V=Cs*p.weight;
  const limit=system.limits[cats.governing==='D'?2:cats.governing==='C'?1:0],limitOK=limit===null||(typeof limit==='number'&&p.height<=limit);
  const raw=p.correction?.85*V/a.Vt:null,Cm=p.correction?Math.max(1,raw):null;
  r[axis]={system,Ta,cap,T,infill,Ct:q.Ct,exponent:q.x,plateau,periodTerm,minimum,Cs,V,limit,limitOK,raw,Cm,Vt:p.correction?a.Vt:null,corrected:p.correction?Cm*a.Vt:null,periodCapped:a.periodMode==='analysis'&&a.period>cap};
 }
 if([r.SDS,r.SD1,r.T0,r.Ts,r.Cu,...['x','y'].flatMap(a=>[r[a].Ta,r[a].cap,r[a].T,r[a].periodTerm,r[a].Cs,r[a].V,...(p.correction?[r[a].Cm,r[a].corrected]:[])])].some(v=>!Number.isFinite(v)))return {valid:false,errors:['입력값이 계산 가능한 수치 범위를 벗어났습니다. 단위와 값을 확인하세요.']};
 return r;
}
const api={SYSTEMS,SOILS,PERIODS,interpolate,category,spectrum,validate,calculate};root.Seismic=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
