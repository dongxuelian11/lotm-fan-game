/** Literal evidence from the completed immutable656-command continuation.
 * The original639-command public-projection blocker remains byte-for-byte.
 * These values were captured after the bounded same-state resume; no outcome,
 * release application, health refill, seed or replacement death is invented. */
export interface TimeWormCaptureEvidence {
  sourceSha256: string; peacefulSha256: string; deathSha256: string; originalDeathSha256: string;
  rawInitialSha256: string; rawSourceStateSha256: string; rawSourceStateSortedSha256: string; rawRootHashes: Record<string, string>;
  peacefulStateSha256: string; deathStateSha256: string; originalDeathStateSha256: string; prefixSha256: string; rawFinalSha256: string; rawPrefixFinalSha256: string;
  naturalSha256: string; producerSha256: string; originalProducerSha256: string; boundaryIndexSha256: string; boundaryStepsSha256: string;
  integritySha256: string; summarySha256: string; commandsSha256: string; publicSha256: string; sourcePrefixSha256: string; transitionsSha256: string; resumeVerificationSha256: string;
  metadataHashes: Record<string, string>; fileHashes: Record<string, string>; continuationSource: Record<string, unknown>; preservedFailureFiles: Record<string, string>;
  commandCount: number; stage: string; error: string | null; boundaryNames: number; uniqueBoundaryFiles: number; uniqueBoundaryBytes: number; uniqueBoundaryFinalStates: number;
  snapshots: string[]; sqliteRepresentatives: string[]; final: Record<string, unknown>; finalFinance: Record<string, unknown>; originalCharacter: Record<string, unknown>; strategy: Record<string, unknown>;
  treatments: unknown[]; acquisitionChecks: unknown[]; lifeChecks: unknown[]; lifeCaseResults: Record<string, unknown>; lifeAbilityUse: Record<string, unknown>; actualCosts: Record<string, unknown>;
  lifeJournalSha256: string; sourceHistorySha256: string; sourceSceneSha256: string; currentOriginalSite: Record<string, unknown>; withdrawalEvidence: unknown[];
  combatAbilityUse: Record<string, unknown>; encounter: Record<string, unknown>; encounterSha256: string; terminal: unknown; rounds: unknown[]; roundHashes: string[]; bottles: unknown[]; potionOutcomes: string[];
}

export const TIME_WORM_CAPTURE_EVIDENCE: TimeWormCaptureEvidence = {
  "sourceSha256": "4669ff84e79414608c873031a6a46fcfb11727c84eee5ef52a473e6685304c08",
  "peacefulSha256": "e8ee10feef684891b509016e10c135260835703f572e9c624168996f66cfc381",
  "deathSha256": "eb720bdd47384fd4741ebf0afa3020d6b55263fb6ebb2c1f68a5e69468b85dda",
  "originalDeathSha256": "eb720bdd47384fd4741ebf0afa3020d6b55263fb6ebb2c1f68a5e69468b85dda",
  "rawInitialSha256": "8da3665e38f0f26f0508f587bf2e6c692f0e142c6346304db90a03f772cff1d5",
  "rawSourceStateSha256": "5971e5ca7dea4e8296f33812953f243766690e8dc76acbc1980238958f5b3efc",
  "rawSourceStateSortedSha256": "e0f411a7e74bd3715c2bc4d5d99c142ee9460881070fa0ffd43b716ff0a5a7d6",
  "rawRootHashes": {
    "marauder": "98e019844f978240915dec624c275a7ab6a3473a0c56a8929d2e13c4fd73fe62",
    "swindler": "765f5d49d081c6d905af96339f5426f606d52fa7afd468f5c0c2c379fce76817",
    "cryptologist": "40be111afbaba2e099fce58a2b73e3796158473c7b9eacb4227479079044c2f4",
    "fireThief": "787c181cb87db5180c093bc20ee3b094a517bbcad392fb40c90145ef452c7af1",
    "dreamStealer": "76060d64f3e24c1ef7f05b3c7560f5723a1dc6afd468002755b74e3f19f2e034",
    "parasite": "1eb337c1019df9c9c5285b41baf46b4fe51cb1ab3fc3812132165a32766df331",
    "deceitMentor": "6c0d438e926faf77bdea1e1bc48c0d407562add4b764ab54e5a82922cbd2fce9",
    "fateTrojan": "dfff572376ff68793d87088f20aea93d1e5d5ef4e89e9a434f4a1268dc5271a1"
  },
  "peacefulStateSha256": "a4a2080d86a0dd71af23ae7ca44039330324de84a6d051b58b3914744c61aaf4",
  "deathStateSha256": "9f5928ba4cd7acf0118b003dfa8cafe8c278c8a33016bc9f206f498476ef64c3",
  "originalDeathStateSha256": "9f5928ba4cd7acf0118b003dfa8cafe8c278c8a33016bc9f206f498476ef64c3",
  "prefixSha256": "fe805c7924a0b0009fff1b6cf49cbc8571555a60989271994c26ef162bb35dc2",
  "rawFinalSha256": "d3ea705e1189adffe7476998f80994a2b4a8d0fb6d04421b07d89248873e0acc",
  "rawPrefixFinalSha256": "c6f1aa074a01229bb1041e07e792c5e7839e449df8cd6a26ed6e1e569db54380",
  "naturalSha256": "e9920991623fdd3f1b8ecf4e5c8049720f362145462703d6b804afa9dfd390cf",
  "producerSha256": "c7219e308742c368d0031493019dc5d7c7f2fb1a0ca011729243d0254e5e9208",
  "originalProducerSha256": "17bad40046874e8cc5d739a1e1a2508c42968a44cf8d55e55bc7622aad4eacea",
  "boundaryIndexSha256": "f5e00632783acb83af14931230f921547212844b6364c9ffa5c86274c5a1f444",
  "boundaryStepsSha256": "cdd3f35b194b24da4e1b5b2b443dc133f3fa658a33ae223ad0fa84b05e0fe9f9",
  "integritySha256": "f0249b2b08afe900d00b58c2f69669fe37c039976dcf1c27eff105f4f13b4604",
  "summarySha256": "b69b28ace8cf3bd2d52dcd71480adce53b12cc07c0bd36063d5af719e7c157a3",
  "commandsSha256": "b2e3b94872480770b4e597fe32ba60bebee64907ce7c39f9ec6c33592ad01265",
  "publicSha256": "49ba8b10acafc3d74ca8f462ac3672eda335bf0d9f282bf997d9220dbbb72385",
  "sourcePrefixSha256": "ffa1ae2c0414627517f48ba623ae968f1b6dd89a1ab22ba792133f6a7200ee80",
  "transitionsSha256": "921fd5d0b30b130a2fb3ab5d433159d559210b85b44649fe9e2b4d12a8c64afa",
  "resumeVerificationSha256": "3ffa558977980e343e10d38cb1a7307692dd4fecea86683b9230fbe01658c8fc",
  "metadataHashes": {
    "natural.json": "e9920991623fdd3f1b8ecf4e5c8049720f362145462703d6b804afa9dfd390cf",
    "summary.json": "b69b28ace8cf3bd2d52dcd71480adce53b12cc07c0bd36063d5af719e7c157a3",
    "capture-integrity.json": "f0249b2b08afe900d00b58c2f69669fe37c039976dcf1c27eff105f4f13b4604",
    "commands.jsonl": "b2e3b94872480770b4e597fe32ba60bebee64907ce7c39f9ec6c33592ad01265",
    "public.jsonl": "49ba8b10acafc3d74ca8f462ac3672eda335bf0d9f282bf997d9220dbbb72385",
    "source-prefix.json": "ffa1ae2c0414627517f48ba623ae968f1b6dd89a1ab22ba792133f6a7200ee80",
    "boundaries.index.json": "f5e00632783acb83af14931230f921547212844b6364c9ffa5c86274c5a1f444",
    "boundaries.steps.json": "cdd3f35b194b24da4e1b5b2b443dc133f3fa658a33ae223ad0fa84b05e0fe9f9",
    "transitions.json": "921fd5d0b30b130a2fb3ab5d433159d559210b85b44649fe9e2b4d12a8c64afa",
    "resume-verification.json": "3ffa558977980e343e10d38cb1a7307692dd4fecea86683b9230fbe01658c8fc",
    "prior-blocker-natural.json": "125dd0290a1c11925ea52f4feb9bc9ba72747d8d693a93fb3f468796657916cd",
    "prior-blocker-capture-integrity.json": "769227e0201492e9a8c7d506b2ed7ebb6c9e6b510b7399261a481d16ff55f0dc",
    "prior-blocker-summary.json": "c76859730af73a458ca3134ac6d575998da2488f04c095f301bd036b12da9f8d",
    "prior-blocker-commands.jsonl": "a4ecd4a20a563bf1532f715b0ca016dce36784ac97d7b08c81ff7b380479829b",
    "prior-blocker-public.jsonl": "92adbee9012a85a970ecc8ff0fdf0aac40aa8f99da8f6db5e68c5c582cb7832d",
    "prior-blocker-source-prefix.json": "ffa1ae2c0414627517f48ba623ae968f1b6dd89a1ab22ba792133f6a7200ee80",
    "prior-blocker-boundaries.index.json": "9d3fbcced1628b8fa2385e3ab0e153561876dccf48f0f09821219886516ba5e9",
    "prior-blocker-boundaries.steps.json": "f180860171edd23c0d2487a39c7b512d7eec6af96344321de865c255ef3dd497",
    "prior-blocker-transitions.json": "5eedc6458155a8150dad35d7abb19eb0b07dcdbddb4e12783926f67dc596c69b"
  },
  "fileHashes": {
    "boundary-exact-original551-command-living-source.json": "c4593dbc889b0607f4589a2621fa44762a5039455a159eac4d9da439f4a97ab1",
    "boundary-actual-rest-requests-known-clinic.json": "4f4eb42adfed20fd638774ea5538ecce68d75d17f140f6a1ff986fbc8ddbc493",
    "boundary-actual-clinic-pay60.json": "22600577bc59de829dc512a875a3e4b8e2c56c1e8c6f706f90eeb6d0816ff7e9",
    "boundary-actual-subsequent-injury-rest.json": "7ae424596c90612f4a2f57bda9f952f7926a5b48a3dbbbdf77f52c0e7f5b680c",
    "boundary-actual-subsequent-injury-rest-2.json": "e3ad6a4750c99d9a0ff877f2220f925a402ba96f1d241a0f2fb42402d7c24561",
    "boundary-actual-subsequent-injury-rest-3.json": "7e051703122a7f69eef3359f1e50159f9efd26355c7035544f2a045f05742dfb",
    "boundary-actual-subsequent-injury-rest-4.json": "4e414cb2757af209794f4c447e318c78b792b9e2e5ded3150129449875746bbc",
    "boundary-step-558-action.json": "35f90d635e36614bb01f17b0dde0fa888cc7ca678f5d2008367e523275071366",
    "boundary-step-559-action.json": "5f5cc734a431442a71e408b90b8ece0e944d6674c47844f6a1767aa8e01fc3cf",
    "boundary-step-560-action.json": "3bedabeaeb57363b2c36c5fa82d618a53fb89b9ba127597400f20f5e5b397aef",
    "boundary-step-561-action.json": "01171506ad1169793201fae0a77a868ea3a6226d103c032578308932c802bb30",
    "boundary-step-562-action.json": "d0749d723f394bb7c856a0f39f438095ce9ebbaaad0694fceba4904e261734b3",
    "boundary-step-563-action.json": "f4eee95b58f27ba886b2349623b0d71f6b291f89d09a7d1ed92409da6b3c654f",
    "boundary-actual500p-guidance-freezes-eight-original-error-roots.json": "246c1ef8feaf625bf4ae877f917759c89598a5187df0e062b2dfe1624634d144",
    "boundary-actual-preparation-VERIFY_ORIGINALS.json": "2ef3ab896a45258586ac57e79acd7196292610c79fa3f7ec9be5984cb805ce67",
    "boundary-actual-preparation-DECLARE_PENDING_ACTION.json": "7a58138e05446e2e15e7cc98b427cd33804eee65dcfce598173aecfd6520bad4",
    "boundary-actual-preparation-PLAN_RETURN.json": "78612a72a62c2c8d683a58af29e6a384b7314cbacf45ad025aadb903159d73e3",
    "boundary-time-worm-potion-1-actual-labour.json": "6c86b09edccff87f48df9873aa44a2d3a8f2e96e86ba1ea56280fccbbb1b79d4",
    "boundary-time-worm-potion-1-actual-labour-2.json": "7e60f1d7fb9d542e95c8e9dfdd0a2d31f97aaa764c40bbba4a07eac9cd0e7e65",
    "boundary-time-worm-potion-1-actual-labour-3.json": "98b1e907afee55b6d326febf19f44dbbade9553a403361090fb9256f58bd3640",
    "boundary-time-worm-potion-1-actual-labour-4.json": "e697eb0a683adc838b20e55a7f0242cf312b9d138464584a23cf152c3ea8d556",
    "boundary-time-worm-potion-1-actual-labour-5.json": "1b66aa06e96594e0fc3e296e53d43c19ab9a3738907d0961846790b168446917",
    "boundary-step-573-action.json": "a2fdddeba19b28209c22e3b568acc824b039d3b04c1a05341aa32c671aae4a97",
    "boundary-step-574-action.json": "2859441a15ae96277735904ed0ffa5c76423d81aa74b01a5307d116c0a1a4b25",
    "boundary-step-575-action.json": "ea8175db347cc1856f33bbbad29ce36a8ab10ebce500f24153b4e23338c2be50",
    "boundary-step-576-action.json": "6c9aaa7c0f92bbc0887eef7d56bf75b3e4827e5a63dca15f46aee8fdf2eafe49",
    "boundary-step-577-action.json": "9b67ceffb8d86a49968b051b27b78f28ae1f7343780197522090822fad9590da",
    "boundary-step-578-action.json": "33d3ae3d365cf0e327d3604648877a3fe435a53a3e61ce94d0692d1d7a7dd791",
    "boundary-step-579-action.json": "87bf0e708694b8bb860f04ca2fee5a2250ea88b39897e8e2497b2aec121c900b",
    "boundary-step-580-action.json": "1a1fe4f053369c489ea86688b1910a6af637cf327c3a95d9b8510c99d09665d6",
    "boundary-step-581-action.json": "95196e85f8a03592589fc8a656dfb70f3d5fbdb6b7480b56e949680924e08fc2",
    "boundary-step-582-action.json": "aa83706cb6cff9de385cbeffd50873d889d3771ffdc44fbfa1bc570f185b7eaa",
    "boundary-step-583-action.json": "a4eeae7d6ae4fb79d4d97ff990e1447aacc414f688d67405a4fdaea04f22e0f5",
    "boundary-step-584-action.json": "d6516f283951eafd500d41aadeb55d07f047e030f23b1c3f8e3f9e89f249fe07",
    "boundary-step-585-action.json": "383a74723bb72303fd4078aacf3c64b0008503bb260a532e5f9e715f1a8a88f5",
    "boundary-step-586-action.json": "6e4bab7d430ab35f1359d95fe155cbee0f67c5f9f680fec54ef0f19e20d28693",
    "boundary-step-587-action.json": "5274ec835f882fea8f8de5cdf683d63ac9123c9604a79e4d2ac18e0d5a20707c",
    "boundary-step-588-action.json": "2302d8e26590b81a230c9b5788656d2429eb1532a112598e5549d2fd4e610099",
    "boundary-step-589-action.json": "e5e0b6e799589860aeb5321fa2102cf60cc38e3fa3f77b4c5db548cf8a186cb9",
    "boundary-actual1100p-buy-time-worm-potion-1.json": "1533f934bc7db1ee794caeae990fbd1656472ba2196a943706acf74d36fe63cb",
    "boundary-actual150p-current-week-preparation-time-worm-potion-1.json": "1b07d0d5a8ac60db8c69e24d8d5bbf95319038c082abde39a1f9e94ac599011c",
    "boundary-actual-consumption-time-worm-potion-1.json": "d877d3dbcfb0a2c1a219c02b240f2968c722ce45e6b48bf1e2b99c19c0c409f0",
    "boundary-delayed-observation-actual-original-observation.json": "0ef752150e908ac51d30cb5faac0915ba8fd268b362b5056bb303e91ebcb4304",
    "boundary-step-594-action.json": "21a80eccc472ae6f783874b5c637117e30bca1526e12457949917672bb9a0bf4",
    "boundary-step-595-action.json": "44b1d3bde1966e0b42f50261b74264c95d6f832edc90f1ea8cbb75445cf0d019",
    "boundary-step-596-action.json": "ebe73443587316bcb198d04f1ea5cae7c5d9fb0fc941f1e44f68e4fa63192896",
    "boundary-delayed-observation-actual20p1AP-fresh-preparation.json": "fd63271e211637ce425eeff6488b04f10da0274863428c624a7529fbf1999bcd",
    "boundary-delayed-observation-fresh-owner-consent.json": "5bfb250dd04089eaa4bf3e163c7cf9ad58c1cdd24e17a0116ed4a26f784826a8",
    "boundary-delayed-observation-fresh-observer-consent.json": "e7f6a5b0d2da6c3d3bb35d68faecced737f5e78bd0e5ecd4ed0e7c56bab23eee",
    "boundary-delayed-observation-fresh-ability-consent.json": "2e9311d5aa563ae2fe3557afb209906887bcd8805ac5aee7dc602708d256ae1c",
    "boundary-delayed-observation-both-original-bodies-walk-four-metres-to-desk.json": "006225d02039ab26698ab1b3bef38822a87752112f63b34e4415418ac4ee1af9",
    "boundary-delayed-observation-actual-ordinary-baseline-look.json": "1e724babf81cf5578c820b2fbb9def5383d2f1072c092964019ed0d0fd43a496",
    "boundary-delayed-observation-one-new-pending-original-label-look.json": "c2afa061e6542993abcc6a968caf5b946430eeb3a05c87c91efe0ed6b37a2368",
    "boundary-delayed-observation-single-paid-short-time-theft-attempt.json": "50267c9047be1076aafcc978b0b590f27dfa3e51dda498d9d3ffea8de6b36eac",
    "boundary-delayed-observation-actual-three-second-target-delay.json": "c05abff58b0c8e5e07e627eacdcbcb8c861b6bb85f564dc845b121ec575db5c2",
    "boundary-delayed-observation-original-owner-actually-executes-the-declared-look.json": "b024c8a4d24eff107815c6b5678265d59700b1a57a65e878a03f4ff3ab13eab4",
    "boundary-delayed-observation-both-original-bodies-walk-four-metres-out.json": "2ebfd4540ff926059d930114fa8f31fd98fe04c19b3acf7534114fb920d1722a",
    "boundary-delayed-observation-close-this-contact-without-resetting-any-body.json": "0f43ee58dca9ecaf697faf13f69587743663e0e2dff725d5c936d25b7d78820c",
    "boundary-delayed-observation-honest-actual-result-report.json": "d2de595667b5aa7e648cec17c7a97bee10fbc8238821a25f70f5aef0c2d6e1c4",
    "boundary-released-interval-actual-original-observation.json": "7b04e531c9adbc1490112b8660b4e9ec1252c6da19f2e1db216d437c0bcc2eea",
    "boundary-step-611-action.json": "834187e1779e4771bb8d6c041a6ba0419d572460eec7258c65dde6dd8df6336a",
    "boundary-step-612-action.json": "82f9a67177912d1214f04949c313def6b291460fbeba75efedcd19d7ed0f627b",
    "boundary-actual-outside-paid-energy-rest.json": "fe60c7ec155b11555c22bd4cd69bf64d50aaa1e18fd6db41272538b05fef28a7",
    "boundary-released-interval-actual20p1AP-fresh-preparation.json": "c62d100c643223604a4f3949e042cca59ed0fa3360ab2db681fd6f3d3a0ba3f9",
    "boundary-released-interval-fresh-owner-consent.json": "d1797dd39d38c168e1c77c4c6a64d524670912278252e667b42ff573e9512ef9",
    "boundary-released-interval-fresh-observer-consent.json": "979795878b0854ddf1f005fb68178807040944424dec6e8849303ef0170c8c30",
    "boundary-released-interval-fresh-ability-consent.json": "8a8b2bba4cc6dc1f6b93476041cddac63736a3098b6a0d5de6662a9d907362be",
    "boundary-released-interval-both-original-bodies-walk-four-metres-to-desk.json": "7d7cabd19fe2e67387699bef1300bc67d8768e9966daf357894d4ca05bffd241",
    "boundary-released-interval-actual-ordinary-baseline-look.json": "dd2fe6112c46df59eca13de29e32ffe0c379d9a1f48cb038bc9e049b1bdb1ee2",
    "boundary-released-interval-one-new-pending-original-label-look.json": "4f75e360eaa0e3f06288bb2f99dfd5e01e4c704e9409444f028ed436f5c9bbcd",
    "boundary-released-interval-single-paid-short-time-theft-attempt.json": "b5aac6b848d7c1ca71c7533e16fdedbeb21ba2b175f9dedda77f02da6ca53e92",
    "boundary-released-interval-one-real-comparison-with-ordinary-fallback.json": "19a7a7a8b91b9abd5eab4e1b3977cb2587295f32b8dafa99500d6f87b71a8c37",
    "boundary-released-interval-original-owner-actually-executes-the-declared-look.json": "e1e34f4828128e98c18e731d663d93d5820a9242fc90b69225ea8360421ee6dc",
    "boundary-released-interval-both-original-bodies-walk-four-metres-out.json": "6e5cc4c30c647aa8a7fcbca96095e71266da6d29b5601ad7a71d9556d29b7a9a",
    "boundary-released-interval-close-this-contact-without-resetting-any-body.json": "dc1162ce6318eebe0c15d81994c7e8673302463ea5d44c94a2dd32d3e8ba5b86",
    "boundary-released-interval-honest-actual-result-report.json": "21eaf5f9263aea6fd88ee52118a23eb7a04d3bd4a93ff57c10f39e206862e32f",
    "boundary-withdrawn-delay-actual-original-observation.json": "66ab8581993170842a31e7d5a77c15a1486c30874fb2c941c34f5c0f1369e1d7",
    "boundary-step-628-action.json": "93135910e6080994f6c76be713b54d4c26011210d74eab40792ae60aacd8ad05",
    "boundary-step-629-action.json": "8a43f18c70f9f35bde8a2426ecbbfa7fdf806abab9f17a956be776ecd6d42463",
    "boundary-withdrawn-delay-actual20p1AP-fresh-preparation.json": "397764e323c938148c59ef56ec1c43134c5e1a9d369a108a1031934d3a6e3e27",
    "boundary-withdrawn-delay-fresh-owner-consent.json": "4152f0dd65b834c8389d1fae6f66537d1b0db58f9aa8fd2d55da936db7e00bdf",
    "boundary-withdrawn-delay-fresh-observer-consent.json": "4161bd058e64a4328d9881540af7691f299c4a5621effe5e24bcdf81e583a3f0",
    "boundary-withdrawn-delay-fresh-ability-consent.json": "87707f9d6d05f4e0acf6451d6dda05f4f51d4248194af5ab4c7a15b4b602bbfa",
    "boundary-withdrawn-delay-both-original-bodies-walk-four-metres-to-desk.json": "e373fb52adb17112ae0c973e14f742c9d390abab3630aa686d6bd99234a9dc05",
    "boundary-withdrawn-delay-actual-ordinary-baseline-look.json": "1e706a73d5bdbb91ba04c55133e33d7f3f2dacc67929234f7688a83ccb0c2bbc",
    "boundary-withdrawn-delay-one-new-pending-original-label-look.json": "4cd690d8e80932d82eea763b8689fba789a62f3e2501342025cb93658797aa84",
    "boundary-withdrawn-delay-single-paid-short-time-theft-attempt.json": "7768c31c5ef8e9e7e953ece6a4c61bc2853093e02820166918f123d047d4c13b",
    "boundary-withdrawn-delay-one-real-second-before-withdrawal.json": "16342d46cfe8eae09d9a08b49b9cfdae81175f46b278283547e2d0c7ddd9475e",
    "boundary-withdrawn-delay-withdraw-ability-without-refunding-target-time.json": "a0eaceda2d397a123c29237083e54ffc8d888871043008a7cb5f98b866833a67",
    "boundary-withdrawn-delay-real-one-second-wait.json": "40da5e388d60a7cef06853e04cd03bd855577c36e8022284dd4d376a4c0471d3",
    "boundary-withdrawn-delay-real-one-second-wait-2.json": "93ace66ca5201ef561a630bc143c89fec492425ded84c054f61ab801f3e3881f",
    "boundary-withdrawn-delay-original-owner-actually-executes-the-declared-look.json": "0951b705becf6bcb7dc027ccbaefa5ca50add7121e46336ce739fed6de8aa573",
    "boundary-withdrawn-delay-both-original-bodies-walk-four-metres-out.json": "9d8985fe03dbc023d5c363341bd8730962768b1f2871a5f70ed4c6f3199f2ac9",
    "boundary-withdrawn-delay-close-this-contact-without-resetting-any-body.json": "04d5f70b5b826847a90f42d70e98a36b368f279a13f0f17becbf317c31a6819d",
    "boundary-withdrawn-delay-honest-actual-result-report.json": "7a38d80609509f82f1bcf480b53926f29fa9cf51ac7c66c72c499b22113c6062",
    "boundary-three-honest-actual-reports-reflected.json": "99b6d18957faa59490ad2fb1a2e237212a2f9865894192930df644b70d01e7ac",
    "boundary-step-647-action.json": "91c10b5cd0b66329ab3d6648e390a57185ec81c5f8b494f0459985a71cff9cf8",
    "boundary-step-648-action.json": "57c0d9a5dca7a0542be5aba33c3fd01698ed53da0b937be7cbc0f2846e7ab62d",
    "boundary-step-649-action.json": "b141cf1c587d84be4e84f05c5703c77c9f1e0bd7594af35296dba26a0bcb85e1",
    "boundary-step-650-action.json": "5c5c9c356f41c252f8d62eea490d1368117992ae4bba7ee0f0e88388b8d52255",
    "boundary-actual-four-metre-arrival-and-independent-adrian-name-exchange.json": "038f5e82ce64b0d8c7401968af7881f5ed84ada569989c654923ceaad1b80a64",
    "boundary-fixed-all-policy-before-fight.json": "d5ad73c322ca4f25d9fae77f14daa6af66d5f9293c0e97310026bb7f521fa2da",
    "boundary-independent-optional-adrian-fight.json": "359bf93a56b78e1ee52888aebab1a1648129ccc931fe96e2de09ab2d2dfb9bdd",
    "boundary-combat-round-1.json": "54987c773690db131dd07e71a2c406f2f23ae8c2e4436906d0dd5441d9f2704c",
    "boundary-combat-round-2.json": "3a630762fda023a6ad2dab80565d8e1bd575ddf8dc7b5b139d0f63376d0b69d4",
    "boundary-actual-paid-work-after-living-four-metre-exit.json": "cc1bd1c62c02b0f18d3b8e9b6cbd5ee6e25f863b41be107e6dcc0a8c65d3cf61",
    "snapshot-departure.json": "c6f1aa074a01229bb1041e07e792c5e7839e449df8cd6a26ed6e1e569db54380",
    "snapshot-afterOriginalCare.json": "975d35886fb398d9717ee393774792730ee2c89cf8d6d77cdbfc8ab92252b6af",
    "snapshot-guidance.json": "446495c8e49fc663f067da50b4889e996dd394750cdea292def5978ced2de54e",
    "snapshot-promoted.json": "220453530523cad2e17dd66205be0280c29beb02bd7515a92fb2c787ce674a91",
    "snapshot-practiced.json": "fbefa12fc1445a5460db80b32510a68c5bed8759685d5dcd1308bded3a909921",
    "snapshot-recoveredBeforeEncounter.json": "3a395bbfd66cfcd90a50e71aa090051985aed5d9a4258daabd0097e123f769cc",
    "snapshot-combatStart.json": "b1f31eee1f21263c6c4ac538360ae8d653b246dd70bf7012cae7a326cc277438",
    "snapshot-combatTerminal.json": "d2c4d3794e327babdaf78f61a08b93f519887eb4d010c7db0182d3913341eac9"
  },
  "continuationSource": {
    "kind": "EXACT_639_PUBLIC_PREFLIGHT_PROJECTION_REPAIR_ONLY",
    "sourceDirectory": "output/play/time-worm-01970-Dxns4f",
    "originalProducerSha256": "17bad40046874e8cc5d739a1e1a2508c42968a44cf8d55e55bc7622aad4eacea",
    "finalProducerSha256": "c7219e308742c368d0031493019dc5d7c7f2fb1a0ca011729243d0254e5e9208",
    "originalFailureSha256": "125dd0290a1c11925ea52f4feb9bc9ba72747d8d693a93fb3f468796657916cd",
    "originalIntegritySha256": "769227e0201492e9a8c7d506b2ed7ebb6c9e6b510b7399261a481d16ff55f0dc",
    "originalCommandCount": 639,
    "restoredCommandCount": 639,
    "sourcePrefixCount": 551,
    "pendingIntent": {
      "type": "TIME_WORM",
      "command": {
        "type": "WAIT_1"
      }
    },
    "originalFinalSha256": "a6204310e886e0b400b4daced33d73bfe0debbce1929a333cc37792b7737e21d",
    "restoredFinalSha256": "a6204310e886e0b400b4daced33d73bfe0debbce1929a333cc37792b7737e21d",
    "fullStateUnchanged": true,
    "replayedPriorCommands": 0,
    "commandsPrefixBytes": 863715,
    "commandsPrefixSha256": "a4ecd4a20a563bf1532f715b0ca016dce36784ac97d7b08c81ff7b380479829b",
    "publicPrefixBytes": 475866,
    "publicPrefixSha256": "92adbee9012a85a970ecc8ff0fdf0aac40aa8f99da8f6db5e68c5c582cb7832d",
    "exactCommandLedgerThrough639": true,
    "exactPublicLedgerThrough639": true,
    "originalStateRandom": {
      "seed": "marauder-natural-v038",
      "cursor": 366
    },
    "newRandomChanges": false,
    "preservedFiles": {
      "prior-blocker-natural.json": "125dd0290a1c11925ea52f4feb9bc9ba72747d8d693a93fb3f468796657916cd",
      "prior-blocker-capture-integrity.json": "769227e0201492e9a8c7d506b2ed7ebb6c9e6b510b7399261a481d16ff55f0dc",
      "prior-blocker-summary.json": "c76859730af73a458ca3134ac6d575998da2488f04c095f301bd036b12da9f8d",
      "prior-blocker-commands.jsonl": "a4ecd4a20a563bf1532f715b0ca016dce36784ac97d7b08c81ff7b380479829b",
      "prior-blocker-public.jsonl": "92adbee9012a85a970ecc8ff0fdf0aac40aa8f99da8f6db5e68c5c582cb7832d",
      "prior-blocker-source-prefix.json": "ffa1ae2c0414627517f48ba623ae968f1b6dd89a1ab22ba792133f6a7200ee80",
      "prior-blocker-boundaries.index.json": "9d3fbcced1628b8fa2385e3ab0e153561876dccf48f0f09821219886516ba5e9",
      "prior-blocker-boundaries.steps.json": "f180860171edd23c0d2487a39c7b512d7eec6af96344321de865c255ef3dd497",
      "prior-blocker-transitions.json": "5eedc6458155a8150dad35d7abb19eb0b07dcdbddb4e12783926f67dc596c69b"
    }
  },
  "preservedFailureFiles": {
    "prior-blocker-natural.json": "125dd0290a1c11925ea52f4feb9bc9ba72747d8d693a93fb3f468796657916cd",
    "prior-blocker-capture-integrity.json": "769227e0201492e9a8c7d506b2ed7ebb6c9e6b510b7399261a481d16ff55f0dc",
    "prior-blocker-summary.json": "c76859730af73a458ca3134ac6d575998da2488f04c095f301bd036b12da9f8d",
    "prior-blocker-commands.jsonl": "a4ecd4a20a563bf1532f715b0ca016dce36784ac97d7b08c81ff7b380479829b",
    "prior-blocker-public.jsonl": "92adbee9012a85a970ecc8ff0fdf0aac40aa8f99da8f6db5e68c5c582cb7832d",
    "prior-blocker-source-prefix.json": "ffa1ae2c0414627517f48ba623ae968f1b6dd89a1ab22ba792133f6a7200ee80",
    "prior-blocker-boundaries.index.json": "9d3fbcced1628b8fa2385e3ab0e153561876dccf48f0f09821219886516ba5e9",
    "prior-blocker-boundaries.steps.json": "f180860171edd23c0d2487a39c7b512d7eec6af96344321de865c255ef3dd497",
    "prior-blocker-transitions.json": "5eedc6458155a8150dad35d7abb19eb0b07dcdbddb4e12783926f67dc596c69b"
  },
  "commandCount": 656,
  "stage": "SAME_SEED_FULL_PUBLIC_TIME_WORM",
  "error": null,
  "boundaryNames": 110,
  "uniqueBoundaryFiles": 106,
  "uniqueBoundaryBytes": 106,
  "uniqueBoundaryFinalStates": 106,
  "snapshots": [
    "departure",
    "afterOriginalCare",
    "guidance",
    "promoted",
    "practiced",
    "recoveredBeforeEncounter",
    "combatStart",
    "combatTerminal"
  ],
  "sqliteRepresentatives": [
    "exact-original551-command-living-source",
    "promotion",
    "released-interval-single-paid-short-time-theft-attempt",
    "withdrawn-delay-withdraw-ability-without-refunding-target-time",
    "withdrawn-delay-real-one-second-wait",
    "combat-round-1",
    "combat-round-2",
    "actual-paid-work-after-living-four-metre-exit"
  ],
  "final": {
    "status": "ACTIVE",
    "revision": 657,
    "week": 147,
    "date": {
      "epoch": "FIFTH_EPOCH",
      "year": 1352,
      "month": 4,
      "day": 15
    },
    "H": 70,
    "M": 96,
    "S": 112,
    "cash": 867,
    "AP": 3,
    "pollution": 0,
    "injuries": [
      {
        "id": "marauder-rebuild-natural:combat:1:PLAYER:655:0",
        "severity": "HEAVY",
        "acquiredRevision": 655,
        "treatedRevision": null
      }
    ],
    "injuryRisk": 0,
    "random": {
      "seed": "marauder-natural-v038",
      "cursor": 397
    },
    "mastery": {
      "error.s9.agility": 41,
      "error.s9.dexterity": 49,
      "error.s9.theft": 57,
      "error.s8.deceit": 41,
      "error.s7.decryption": 8,
      "error.s6.power-theft": 8,
      "error.s6.borrowed-power": 8,
      "error.s5.thought-theft": 0,
      "error.s4.parasitism": 16,
      "error.s4.deferred-thought": 33,
      "error.s3.law-deceit": 8,
      "error.s3.deep-deception": 8,
      "error.s2.identity-link": 8,
      "error.s2.fate-assumption": 8,
      "error.s1.short-time-theft": 16,
      "error.s1.time-release": 0
    },
    "sequence": 1,
    "acting": 100
  },
  "finalFinance": {
    "weeklyBudget": 3,
    "lifeTier": "DESTITUTE",
    "nextLifeTier": "DESTITUTE",
    "debts": [
      {
        "id": "debt-27-101-0",
        "source": "生活应付款",
        "remaining": 0,
        "weeklyPayment": 30,
        "createdWeek": 27
      },
      {
        "id": "debt-94-363-1",
        "source": "生活应付款",
        "remaining": 0,
        "weeklyPayment": 30,
        "createdWeek": 94
      },
      {
        "id": "debt-101-387-2",
        "source": "生活应付款",
        "remaining": 0,
        "weeklyPayment": 30,
        "createdWeek": 101
      },
      {
        "id": "debt-102-404-3",
        "source": "生活应付款",
        "remaining": 0,
        "weeklyPayment": 30,
        "createdWeek": 102
      },
      {
        "id": "debt-103-420-4",
        "source": "生活应付款",
        "remaining": 0,
        "weeklyPayment": 30,
        "createdWeek": 103
      }
    ],
    "missedWeeks": 0,
    "credit": "NORMAL"
  },
  "originalCharacter": {
    "name": "伊莲",
    "portraitId": "portrait-01",
    "age": 26,
    "gender": "FEMALE",
    "originId": "origin-labor-1",
    "originName": "工厂工资家庭",
    "professionId": "profession-factory-worker",
    "professionName": "工厂工人",
    "education": "BASIC",
    "learningBonus": 0,
    "weeklyWage": 180,
    "coreStats": {
      "physique": 28,
      "perception": 27,
      "will": 25,
      "knowledge": 25
    },
    "birthplace": {
      "id": "birthplace-backlund",
      "label": "贝克兰德"
    },
    "appearanceDescription": "",
    "traits": [
      {
        "id": "trait.diligent",
        "label": "勤勉"
      },
      {
        "id": "trait.watchful",
        "label": "警觉"
      }
    ],
    "flaw": {
      "id": "flaw.timid",
      "label": "畏缩"
    },
    "acceptedConditionIds": [],
    "creationCosts": {
      "professionInitialPence": 120,
      "familyTransferPence": 120,
      "conditionCostPence": 0,
      "educationCostPence": 0
    }
  },
  "strategy": {
    "source": "FULL_551_ACTUAL_ACTIVE_FINAL",
    "sourceSeed": "marauder-natural-v038",
    "sourceCursor": 361,
    "caseMethod": "ABILITY",
    "encounterPolicy": "ALL",
    "combatStance": "CONTROL",
    "combatRoundCap": 90,
    "potionAttemptCap": 12,
    "potionLabourSteps": 5,
    "maxCommands": 3500,
    "ordinaryPreparationCap": 600,
    "originalWoundRecovery": "KNOWN_CLINIC_PAID60_THEN_REAL_REST_UNTIL_HEALED",
    "ordinaryActions": "WORK_ONCE_PER_WEEK_THEN_REST",
    "recoveryBeforePotionAndContact": {
      "health": 100,
      "mind": 100,
      "spirituality": 120,
      "pollution": 0
    },
    "energyRecovery": {
      "minimumBeforeCase": 9,
      "command": "RECOVER_ENERGY",
      "onlyOutsideAfterPromotion": true
    },
    "delayedRoute": [
      "SHORT_TIME_THEFT_ONCE",
      "WAIT_3_ONLY_IF_DELAYED",
      "EXECUTE_LOOK"
    ],
    "releaseRoute": [
      "SHORT_TIME_THEFT_ONCE",
      "TIME_RELEASE_ONCE_ONLY_IF_STORED",
      "COMPARE_LABEL_ONCE",
      "WAIT_1_UNTIL_TARGET_DUE",
      "EXECUTE_LOOK"
    ],
    "withdrawalRoute": [
      "SHORT_TIME_THEFT_ONCE",
      "WAIT_1_ONLY_IF_DELAYED",
      "WITHDRAW_ABILITY",
      "CAPTURE_REMAINING_TARGET_DELAY",
      "WAIT_1_UNTIL_TARGET_DUE",
      "EXECUTE_LOOK"
    ],
    "everyCaseExit": [
      "EXIT_ROOM",
      "LEAVE",
      "REPORT"
    ],
    "reflection": "AFTER_THREE_ACTUAL_REPORTS",
    "failureHandling": "RETAIN_COSTS_AND_FAILED_CHECKS_USE_ORDINARY_COMPLETION_NO_ABILITY_RETRY",
    "eventChoices": {
      "ORIGIN": ".decline",
      "LIFE-BILL-01": "PAY_PART",
      "DEBT-NOTICE-01": "DECLINE",
      "DEBT-SETTLE-01": "DEFER",
      "LIFE-CARE-01": "PAY",
      "CARE-WORK-OFFER": "DECLINE"
    }
  },
  "treatments": [
    {
      "paidPennies": 60,
      "before": {
        "status": "ACTIVE",
        "revision": 553,
        "week": 127,
        "date": {
          "epoch": "FIFTH_EPOCH",
          "year": 1351,
          "month": 11,
          "day": 27
        },
        "H": 48,
        "M": 100,
        "S": 102,
        "cash": 472,
        "AP": 2,
        "pollution": 0,
        "injuries": [
          {
            "id": "marauder-rebuild-natural:combat:4:PLAYER:546:0",
            "severity": "LIGHT",
            "acquiredRevision": 546,
            "treatedRevision": null
          },
          {
            "id": "marauder-rebuild-natural:combat:6:PLAYER:548:1",
            "severity": "LIGHT",
            "acquiredRevision": 548,
            "treatedRevision": null
          },
          {
            "id": "marauder-rebuild-natural:combat:8:PLAYER:550:2",
            "severity": "HEAVY",
            "acquiredRevision": 550,
            "treatedRevision": null
          }
        ],
        "injuryRisk": 2,
        "random": {
          "seed": "marauder-natural-v038",
          "cursor": 361
        },
        "mastery": {
          "error.s9.agility": 41,
          "error.s9.dexterity": 49,
          "error.s9.theft": 57,
          "error.s8.deceit": 41,
          "error.s7.decryption": 8,
          "error.s6.power-theft": 8,
          "error.s6.borrowed-power": 8,
          "error.s5.thought-theft": 0,
          "error.s4.parasitism": 16,
          "error.s4.deferred-thought": 33,
          "error.s3.law-deceit": 8,
          "error.s3.deep-deception": 8,
          "error.s2.identity-link": 8,
          "error.s2.fate-assumption": 8
        },
        "sequence": 2,
        "acting": 100
      },
      "after": {
        "status": "ACTIVE",
        "revision": 554,
        "week": 127,
        "date": {
          "epoch": "FIFTH_EPOCH",
          "year": 1351,
          "month": 11,
          "day": 27
        },
        "H": 48,
        "M": 100,
        "S": 102,
        "cash": 412,
        "AP": 2,
        "pollution": 0,
        "injuries": [
          {
            "id": "marauder-rebuild-natural:combat:4:PLAYER:546:0",
            "severity": "LIGHT",
            "acquiredRevision": 546,
            "treatedRevision": null
          },
          {
            "id": "marauder-rebuild-natural:combat:6:PLAYER:548:1",
            "severity": "LIGHT",
            "acquiredRevision": 548,
            "treatedRevision": null
          },
          {
            "id": "marauder-rebuild-natural:combat:8:PLAYER:550:2",
            "severity": "HEAVY",
            "acquiredRevision": 550,
            "treatedRevision": 554
          }
        ],
        "injuryRisk": 2,
        "random": {
          "seed": "marauder-natural-v038",
          "cursor": 361
        },
        "mastery": {
          "error.s9.agility": 41,
          "error.s9.dexterity": 49,
          "error.s9.theft": 57,
          "error.s8.deceit": 41,
          "error.s7.decryption": 8,
          "error.s6.power-theft": 8,
          "error.s6.borrowed-power": 8,
          "error.s5.thought-theft": 0,
          "error.s4.parasitism": 16,
          "error.s4.deferred-thought": 33,
          "error.s3.law-deceit": 8,
          "error.s3.deep-deception": 8,
          "error.s2.identity-link": 8,
          "error.s2.fate-assumption": 8
        },
        "sequence": 2,
        "acting": 100
      }
    }
  ],
  "acquisitionChecks": [
    [
      {
        "type": "CONSUME",
        "bottleId": "time-worm-potion-1",
        "confirmed": true
      },
      139,
      31,
      40,
      "SUCCESS",
      361,
      362
    ]
  ],
  "lifeChecks": [
    [
      "SHORT_TIME_THEFT",
      28,
      12,
      70,
      "SUCCESS",
      362,
      363
    ],
    [
      "SHORT_TIME_THEFT",
      28,
      93,
      70,
      "FAILURE",
      363,
      364
    ],
    [
      "COMPARE_LABEL",
      26,
      26,
      70,
      "SUCCESS",
      364,
      365
    ],
    [
      "SHORT_TIME_THEFT",
      28,
      7,
      70,
      "SUCCESS",
      365,
      366
    ]
  ],
  "lifeCaseResults": {
    "delayed-observation": {
      "status": "RESOLVED",
      "result": "ABILITY",
      "returned": true,
      "attempts": [
        {
          "closed": true,
          "exited": true,
          "result": "ABILITY",
          "declaration": {
            "id": "TW1:delayed-observation:1:look",
            "caseId": "delayed-observation",
            "attempt": 1,
            "actionId": "TW1:delayed-observation:1:look",
            "targetId": "FT2-VICTOR",
            "parcelId": "FT2-PARCEL",
            "action": "LOOK_AT_ORIGINAL_LABEL",
            "state": "EXECUTED",
            "declaredAt": 762,
            "baselineDueAt": 763,
            "delayStartedAt": 763,
            "dueAt": 766,
            "executedAt": 767,
            "cancelledAt": null,
            "delayedSeconds": 3
          },
          "comparisonAttempted": false,
          "comparisonBonus": 0,
          "comparisonTier": null,
          "theft": {
            "attempts": 1,
            "successes": 1,
            "effects": 1,
            "tier": "SUCCESS",
            "state": "APPLIED"
          },
          "release": {
            "attempts": 0,
            "successes": 0,
            "effects": 0,
            "tier": null,
            "state": "NONE"
          }
        }
      ]
    },
    "released-interval": {
      "status": "RESOLVED",
      "result": "ORDINARY",
      "returned": true,
      "attempts": [
        {
          "closed": true,
          "exited": true,
          "result": "ORDINARY",
          "declaration": {
            "id": "TW1:released-interval:1:look",
            "caseId": "released-interval",
            "attempt": 1,
            "actionId": "TW1:released-interval:1:look",
            "targetId": "FT2-VICTOR",
            "parcelId": "FT2-PARCEL",
            "action": "LOOK_AT_ORIGINAL_LABEL",
            "state": "EXECUTED",
            "declaredAt": 855,
            "baselineDueAt": 856,
            "delayStartedAt": null,
            "dueAt": 856,
            "executedAt": 858,
            "cancelledAt": null,
            "delayedSeconds": 0
          },
          "comparisonAttempted": true,
          "comparisonBonus": 0,
          "comparisonTier": "SUCCESS",
          "theft": {
            "attempts": 1,
            "successes": 0,
            "effects": 0,
            "tier": "FAILURE",
            "state": "FAILED"
          },
          "release": {
            "attempts": 0,
            "successes": 0,
            "effects": 0,
            "tier": null,
            "state": "NONE"
          }
        }
      ]
    },
    "withdrawn-delay": {
      "status": "RESOLVED",
      "result": "ABILITY",
      "returned": true,
      "attempts": [
        {
          "closed": true,
          "exited": true,
          "result": "ABILITY",
          "declaration": {
            "id": "TW1:withdrawn-delay:1:look",
            "caseId": "withdrawn-delay",
            "attempt": 1,
            "actionId": "TW1:withdrawn-delay:1:look",
            "targetId": "FT2-VICTOR",
            "parcelId": "FT2-PARCEL",
            "action": "LOOK_AT_ORIGINAL_LABEL",
            "state": "EXECUTED",
            "declaredAt": 886,
            "baselineDueAt": 887,
            "delayStartedAt": 887,
            "dueAt": 890,
            "executedAt": 891,
            "cancelledAt": null,
            "delayedSeconds": 3
          },
          "comparisonAttempted": false,
          "comparisonBonus": 0,
          "comparisonTier": null,
          "theft": {
            "attempts": 1,
            "successes": 1,
            "effects": 1,
            "tier": "SUCCESS",
            "state": "APPLIED"
          },
          "release": {
            "attempts": 0,
            "successes": 0,
            "effects": 0,
            "tier": null,
            "state": "NONE"
          }
        }
      ]
    }
  },
  "lifeAbilityUse": {
    "error.s1.short-time-theft": {
      "attempts": 3,
      "checkSuccesses": 2,
      "actualApplications": 2,
      "states": [
        "APPLIED",
        "FAILED",
        "APPLIED"
      ]
    },
    "error.s1.time-release": {
      "attempts": 0,
      "checkSuccesses": 0,
      "actualApplications": 0,
      "states": [
        "NONE",
        "NONE",
        "NONE"
      ]
    }
  },
  "actualCosts": {
    "acquisitionCash": 1750,
    "acquisitionAP": 10,
    "lifeCash": 75,
    "lifeAP": 8,
    "lifeSpirituality": 24,
    "lifeMind": 6,
    "playerOrdinaryMetres": 24,
    "linaOrdinaryMetres": 24,
    "victorOrdinaryMetres": 0,
    "playerEnergySpent": 25,
    "playerEnergyRecovered": 20,
    "linaEnergySpent": 27,
    "victorEnergySpent": 6,
    "combatSpirituality": 16,
    "combatMindCasting": 4,
    "enemySpirituality": 21,
    "enemyOriginalMarksSpent": 3,
    "clinic": 60,
    "ordinaryWorkCount": 16,
    "ordinaryRestCount": 24,
    "note": "Mechanism receipts are actual costs; independent weekly settlement remains in the full ledger. No free body, energy, spirituality, cash or time refill."
  },
  "lifeJournalSha256": "aa80461959e11be10b2a8ec52c773f10991236096b17cbe08c4dfbf5e56986a7",
  "sourceHistorySha256": "b7ffb9d38c22afffee2e8516377cbc708bbd41469824334d773bd7b67c2b604c",
  "sourceSceneSha256": "9f39985b5beb8b7df22d1ce0279b88fb53fd2c3405f8d0b681842136d03260c3",
  "currentOriginalSite": {
    "siteId": "FT2-REGISTRY",
    "introducedWeek": 119,
    "introducedDate": {
      "epoch": "FIFTH_EPOCH",
      "year": 1351,
      "month": 10,
      "day": 2
    },
    "clockSeconds": 904,
    "playerLocation": "OUTSIDE",
    "playerTravelMetres": 110,
    "playerEnergy": 4,
    "lina": {
      "id": "FT2-LINA",
      "name": "莉娜",
      "age": 39,
      "alive": true,
      "location": "OUTSIDE",
      "energy": 69,
      "travelMetres": 28
    },
    "victor": {
      "id": "FT2-VICTOR",
      "name": "维克托",
      "age": 43,
      "alive": true,
      "location": "OUTSIDE",
      "energy": 82,
      "travelMetres": 12
    },
    "cabinet": {
      "id": "FT2-CABINET",
      "ownerId": "FT2-VICTOR",
      "quantity": 1,
      "location": "CABINET",
      "recognitionHolder": "OWNER",
      "open": false,
      "playerOpenings": 1,
      "ownerOpenings": 1
    },
    "parcel": {
      "id": "FT2-PARCEL",
      "ownerId": "FT2-VICTOR",
      "quantity": 1,
      "location": "OUTSIDE",
      "ordinaryMetres": 8,
      "carriedBy": "PLAYER"
    },
    "link": {
      "id": "FT2-RECOGNITION",
      "ownerId": "FT2-VICTOR",
      "holder": "OWNER",
      "returnPending": false,
      "windowExpiresAt": null
    },
    "fate": {
      "id": "FT2-ONE-CARRY",
      "parcelId": "FT2-PARCEL",
      "originalDebtor": "FT2-VICTOR",
      "debtor": "PLAYER",
      "from": "CABINET",
      "to": "OUTSIDE",
      "status": "COMPLETED",
      "offeredPennies": 12,
      "escrowPennies": 0,
      "benefitRecipient": "PLAYER",
      "paidToPlayer": 12,
      "ownerRelieved": true,
      "burdenHealth": 5,
      "burdenEnergy": 5,
      "incurredHealth": 5,
      "incurredEnergy": 5
    },
    "seals": [
      {
        "id": "FT2-SEAL:identity-link",
        "caseId": "identity-link",
        "ownerId": "FT2-LINA",
        "quantity": 1,
        "charges": 0,
        "location": "DESK",
        "paidPennies": 20,
        "preparedWeek": 121
      },
      {
        "id": "FT2-SEAL:fate-assumption",
        "caseId": "fate-assumption",
        "ownerId": "FT2-LINA",
        "quantity": 1,
        "charges": 0,
        "location": "DESK",
        "paidPennies": 20,
        "preparedWeek": 122
      },
      {
        "id": "FT2-SEAL:revoked-link",
        "caseId": "revoked-link",
        "ownerId": "FT2-LINA",
        "quantity": 1,
        "charges": 1,
        "location": "DESK",
        "paidPennies": 20,
        "preparedWeek": 125
      }
    ]
  },
  "withdrawalEvidence": [
    {
      "caseId": "withdrawn-delay",
      "step": 639,
      "before": {
        "clock": 888,
        "declaration": {
          "id": "TW1:withdrawn-delay:1:look",
          "caseId": "withdrawn-delay",
          "attempt": 1,
          "actionId": "TW1:withdrawn-delay:1:look",
          "targetId": "FT2-VICTOR",
          "parcelId": "FT2-PARCEL",
          "action": "LOOK_AT_ORIGINAL_LABEL",
          "state": "DELAYED",
          "declaredAt": 886,
          "baselineDueAt": 887,
          "delayStartedAt": 887,
          "dueAt": 890,
          "executedAt": null,
          "cancelledAt": null,
          "delayedSeconds": 1
        },
        "pending": {
          "caseId": "withdrawn-delay",
          "declarationId": "TW1:withdrawn-delay:1:look",
          "createdAt": 887,
          "expiresAt": 890,
          "permissionVersion": 3,
          "state": "STORED",
          "bonus": 8
        },
        "S": 112,
        "M": 98,
        "ap": 0,
        "week": 143
      },
      "after": {
        "clock": 888,
        "declaration": {
          "id": "TW1:withdrawn-delay:1:look",
          "caseId": "withdrawn-delay",
          "attempt": 1,
          "actionId": "TW1:withdrawn-delay:1:look",
          "targetId": "FT2-VICTOR",
          "parcelId": "FT2-PARCEL",
          "action": "LOOK_AT_ORIGINAL_LABEL",
          "state": "DELAYED",
          "declaredAt": 886,
          "baselineDueAt": 887,
          "delayStartedAt": 887,
          "dueAt": 890,
          "executedAt": null,
          "cancelledAt": null,
          "delayedSeconds": 1
        },
        "pending": null
      },
      "targetRemainingSeconds": 2
    }
  ],
  "encounter": {
    "status": "RESOLVED",
    "targetId": "TW1-ADRIAN",
    "terminal": {
      "outcome": "ENEMY_SURRENDERED",
      "round": 2,
      "historyIndex": 30,
      "enemyHealth": 70,
      "enemyMind": 100,
      "enemySpirituality": 99,
      "enemyStatus": "SURRENDERED",
      "exitMetres": 4,
      "exitSeconds": 4
    },
    "scene": {
      "siteId": "TW1-YARD",
      "playerLocation": "OUTSIDE",
      "playerCoordinate": 0,
      "enemyCoordinate": 6,
      "ordinaryExit": "OPEN",
      "visibleBodyLine": true,
      "conditionVersion": 1,
      "observedConditionVersion": 1,
      "thirdPartiesInArea": 0,
      "presentMemberIds": [],
      "observedSourceId": "marauder-rebuild-natural:TW1-YARD:652",
      "observationWeek": 146,
      "clockSeconds": 128,
      "externalSeconds": 128,
      "playerTravelMetres": 16,
      "enemyTravelMetres": 20,
      "knownPlayerName": "伊莲",
      "knownEnemyName": "艾德里安·凯斯"
    },
    "materials": {
      "weapon": {
        "id": "TW1-ADRIAN-CLUB",
        "sourceId": "TW1-ADRIAN-OWNED-CLUB-1",
        "owner": "TW1-ADRIAN",
        "massKg": 2,
        "location": "YARD",
        "condition": 100,
        "visible": true
      },
      "marks": [
        {
          "id": "TW1-ADRIAN-MARK-1",
          "owner": "TW1-ADRIAN",
          "status": "SPENT",
          "usedRound": 1
        },
        {
          "id": "TW1-ADRIAN-MARK-2",
          "owner": "TW1-ADRIAN",
          "status": "SPENT",
          "usedRound": 1
        },
        {
          "id": "TW1-ADRIAN-MARK-3",
          "owner": "TW1-ADRIAN",
          "status": "SPENT",
          "usedRound": 1
        }
      ]
    },
    "enemyHealth": 70,
    "enemyMind": 100,
    "enemySpirituality": 99,
    "enemyInjuries": [
      {
        "id": "marauder-rebuild-natural:combat:2:ENEMY:656:0",
        "severity": "HEAVY",
        "acquiredRevision": 656,
        "treatedRevision": null
      }
    ],
    "powerUses": {
      "BODY_MARK": 2,
      "MENTAL_MARK": 1,
      "FEINT": 0
    },
    "shortTimeTheft": {
      "attempts": 2,
      "successfulWindows": 1,
      "actualApplications": 0
    },
    "timeRelease": {
      "attempts": 0,
      "successfulWindows": 0,
      "actualApplications": 0
    }
  },
  "encounterSha256": "4f4bec4591e2a895371d5983c62604561246c1da101d0e53a47a92481596e8c2",
  "terminal": {
    "outcome": "ENEMY_SURRENDERED",
    "round": 2,
    "historyIndex": 30,
    "enemyHealth": 70,
    "enemyMind": 100,
    "enemySpirituality": 99,
    "enemyStatus": "SURRENDERED",
    "exitMetres": 4,
    "exitSeconds": 4
  },
  "rounds": [
    {
      "round": 1,
      "stance": "CONTROL",
      "consequenceDomain": "BODY",
      "consequenceRoll": 76,
      "result": {
        "playerHealth": 70,
        "playerMind": 98,
        "playerSpirituality": 112,
        "enemyHealth": 100,
        "enemyMind": 100,
        "enemySpirituality": 99,
        "expiredWindows": [],
        "waits": [
          {
            "fromSeconds": 13,
            "toSeconds": 64,
            "seconds": 51,
            "reason": "ROUND_REMAINDER",
            "targetActionId": null
          }
        ],
        "targetDelays": []
      }
    },
    {
      "round": 2,
      "stance": "CONTROL",
      "consequenceDomain": "BODY",
      "consequenceRoll": 89,
      "result": {
        "playerHealth": 70,
        "playerMind": 96,
        "playerSpirituality": 112,
        "enemyHealth": 70,
        "enemyMind": 100,
        "enemySpirituality": 99,
        "expiredWindows": [],
        "waits": [
          {
            "fromSeconds": 75,
            "toSeconds": 124,
            "seconds": 49,
            "reason": "ROUND_REMAINDER",
            "targetActionId": null
          }
        ],
        "targetDelays": []
      }
    }
  ],
  "roundHashes": [
    "59aa1ae386de695a341452ccad9d6509e97a782c898c19f1739f56707aa18e03",
    "4df847ddac301a923d08e4a14b870bdb3f4cb5545100d6ebbac0aaf03235a748"
  ],
  "bottles": [
    {
      "id": "time-worm-potion-1",
      "source": "贝克兰德时之虫独立成品交接处初始批次第1瓶序列1时之虫成品魔药，独立封存编号time-worm-potion-1。本瓶单独交付与耗用，不改装旧命运木马原瓶，也不补回以前耗尽的原瓶。",
      "stockedWeek": null,
      "labourSteps": 5,
      "acquiredWeek": 139,
      "consumedWeek": 139,
      "preparationWeek": 139,
      "status": "CONSUMED",
      "outcome": "SUCCESS"
    },
    {
      "id": "time-worm-potion-2",
      "source": "贝克兰德时之虫独立成品交接处初始批次第2瓶序列1时之虫成品魔药，独立封存编号time-worm-potion-2。本瓶单独交付与耗用，不改装旧命运木马原瓶，也不补回以前耗尽的原瓶。",
      "stockedWeek": null,
      "labourSteps": 0,
      "acquiredWeek": null,
      "consumedWeek": null,
      "preparationWeek": null,
      "status": "SUPPLIER",
      "outcome": null
    },
    {
      "id": "time-worm-potion-3",
      "source": "贝克兰德时之虫独立成品交接处初始批次第3瓶序列1时之虫成品魔药，独立封存编号time-worm-potion-3。本瓶单独交付与耗用，不改装旧命运木马原瓶，也不补回以前耗尽的原瓶。",
      "stockedWeek": null,
      "labourSteps": 0,
      "acquiredWeek": null,
      "consumedWeek": null,
      "preparationWeek": null,
      "status": "SUPPLIER",
      "outcome": null
    }
  ],
  "potionOutcomes": [
    "SUCCESS"
  ],
  "combatAbilityUse": {
    "error.s1.short-time-theft": {
      "plannedSelections": 2,
      "paidAttempts": 2,
      "successfulChecks": 1,
      "actualApplications": 0
    },
    "error.s1.time-release": {
      "plannedSelections": 2,
      "paidAttempts": 0,
      "successfulChecks": 0,
      "actualApplications": 0
    }
  }
};

export function actualTimeWormEvidence(): TimeWormCaptureEvidence {
  return TIME_WORM_CAPTURE_EVIDENCE;
}
