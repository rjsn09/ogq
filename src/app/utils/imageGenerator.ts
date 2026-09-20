export interface Variant {
  id: string;
  name: string;
  category: '감정' | '인사' | '리액션' | '동작';
}
export interface Prompts {
  id: string;
  name: string;
  prompt: string;
}

export const VARIANT_CATALOG: Variant[] = [
  { id: 'v01', name: '기본', category: '감정' },
  { id: 'v02', name: '활짝 웃음', category: '감정' },
  { id: 'v03', name: '수줍음', category: '감정' },
  { id: 'v04', name: '졸려요', category: '감정' },
  { id: 'v05', name: '화났어요', category: '감정' },
  { id: 'v06', name: '슬퍼요', category: '감정' },
  { id: 'v07', name: '깜짝!', category: '리액션' },
  { id: 'v08', name: '사랑해요', category: '감정' },
  { id: 'v09', name: '생각중', category: '동작' },
  { id: 'v10', name: '굿!', category: '리액션' },
  { id: 'v11', name: 'OK!', category: '리액션' },
  { id: 'v12', name: '파이팅!', category: '리액션' },
  { id: 'v13', name: '하하하', category: '감정' },
  { id: 'v14', name: '당황', category: '감정' },
  { id: 'v15', name: '신남!', category: '감정' },
  { id: 'v16', name: '힘들어요', category: '감정' },
  { id: 'v17', name: '배고파', category: '동작' },
  { id: 'v18', name: '냠냠', category: '동작' },
  { id: 'v19', name: '잘게요', category: '동작' },
  { id: 'v20', name: '안녕!', category: '인사' },
  { id: 'v21', name: '감사해요', category: '인사' },
  { id: 'v22', name: '미안해요', category: '인사' },
  { id: 'v23', name: '응원해요', category: '리액션' },
  { id: 'v24', name: '최고야!', category: '리액션' },
  { id: 'v25', name: '박수쳐요', category: '동작' },
  { id: 'v26', name: '안아줘요', category: '동작' },
  { id: 'v27', name: '토닥토닥', category: '동작' },
  { id: 'v28', name: '메롱', category: '리액션' },
  { id: 'v29', name: '엉엉', category: '감정' },
  { id: 'v30', name: '두근두근', category: '감정' },
  { id: 'v31', name: '헐...', category: '리액션' },
  { id: 'v32', name: '땀뻘뻘', category: '감정' },
  { id: 'v33', name: '축하해요', category: '인사' },
  { id: 'v34', name: '반가워요', category: '인사' },
  { id: 'v35', name: '시무룩', category: '감정' },
  { id: 'v36', name: '으쓱', category: '동작' },
];

export const VARIANT_PROMPTS: Prompts[] = [
  { id: 'v01', name: '기본', prompt: '' },
  { id: 'v02', name: '활짝 웃음', prompt: '' },
  { id: 'v03', name: '수줍음', prompt: '' },
  { id: 'v04', name: '졸려요', prompt: '' },
  { id: 'v05', name: '화났어요', prompt: '' },
  { id: 'v06', name: '슬퍼요', prompt: '' },
  { id: 'v07', name: '깜짝!', prompt: '' },
  { id: 'v08', name: '사랑해요', prompt: '' },
  { id: 'v09', name: '생각중', prompt: '' },
  { id: 'v10', name: '굿!', prompt: '' },
  { id: 'v11', name: 'OK!', prompt: '' },
  { id: 'v12', name: '파이팅!', prompt: '' },
  { id: 'v13', name: '하하하', prompt: '' },
  { id: 'v14', name: '당황', prompt: '' },
  { id: 'v15', name: '신남!', prompt: '' },
  { id: 'v16', name: '힘들어요', prompt: '' },
  { id: 'v17', name: '배고파', prompt: '' },
  { id: 'v18', name: '냠냠', prompt: '' },
  { id: 'v19', name: '잘게요', prompt: '' },
  { id: 'v20', name: '안녕!', prompt: '' },
  { id: 'v21', name: '감사해요', prompt: '' },
  { id: 'v22', name: '미안해요', prompt: '' },
  { id: 'v23', name: '응원해요', prompt: '' },
  { id: 'v24', name: '최고야!', prompt: '' },
  { id: 'v25', name: '박수쳐요', prompt: '' },
  { id: 'v26', name: '안아줘요', prompt: '' },
  { id: 'v27', name: '토닥토닥', prompt: '' },
  { id: 'v28', name: '메롱', prompt: '' },
  { id: 'v29', name: '엉엉', prompt: '' },
  { id: 'v30', name: '두근두근', prompt: '' },
  { id: 'v31', name: '헐...', prompt: '' },
  { id: 'v32', name: '땀뻘뻘', prompt: '' },
  { id: 'v33', name: '축하해요', prompt: '' },
  { id: 'v34', name: '반가워요', prompt: '' },
  { id: 'v35', name: '시무룩', prompt: '' },
  { id: 'v36', name: '으쓱', prompt: '' },
]

export const DEFAULT_PROMPTS: Prompts[] = VARIANT_PROMPTS.slice(0, 24);

export const DEFAULT_VARIANTS: Variant[] = VARIANT_CATALOG.slice(0, 24);

export const VARIANTS = DEFAULT_VARIANTS;