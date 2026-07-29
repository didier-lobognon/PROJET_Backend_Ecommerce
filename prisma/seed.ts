import {
  ContentStatus,
  HomepageBannerButtonStyle,
  HomepageBannerImageSide,
  HomepageBannerSlot,
  HomepageBannerTextAlign,
  PrismaClient,
  ProductMovementType,
  ProductStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const BCRYPT_SALT_ROUNDS = 12;

const FRONTEND_URL = 'http://localhost:3000';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  console.log('🌱 Seeding Kaniê database...\n');

  // ─── Admin User ───────────────────────────────────────────────────────────────
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@kanie.ci';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_SALT_ROUNDS);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: UserRole.ADMIN },
    create: {
      email: adminEmail,
      passwordHash,
      role: UserRole.ADMIN,
      firstName: 'Admin',
      lastName: 'Kaniê',
      emailVerifiedAt: new Date(),
    },
  });

  // Client test
  const clientHash = await bcrypt.hash('Client123!', BCRYPT_SALT_ROUNDS);
  await prisma.user.upsert({
    where: { email: 'client@test.ci' },
    update: { emailVerifiedAt: new Date() },
    create: {
      email: 'client@test.ci',
      passwordHash: clientHash,
      role: UserRole.CLIENT,
      firstName: 'Kouassi',
      lastName: 'Jean',
      phone: '+2250701234567',
      emailVerifiedAt: new Date(),
    },
  });

  // ─── Categories ───────────────────────────────────────────────────────────────
  const categoriesData = [
    { name: 'Ordinateurs portables & desktops', slug: 'ordinateurs', imageUrl: '/images/categories/categories-01.png' },
    { name: 'Smartphones & tablettes', slug: 'smartphones-tablettes', imageUrl: '/images/categories/categories-02.png' },
    { name: 'Accessoires & périphériques', slug: 'accessoires-peripheriques', imageUrl: '/images/categories/categories-03.png' },
    { name: 'Audiovisuel', slug: 'audiovisuel', imageUrl: '/images/categories/categories-04.png' },
    { name: 'Réseau & connectivité', slug: 'reseau-connectivite', imageUrl: '/images/categories/categories-05.png' },
    { name: 'Imprimantes & scanners', slug: 'imprimantes-scanners', imageUrl: '/images/categories/categories-06.png' },
    { name: 'Logiciels & licences', slug: 'logiciels-licences', imageUrl: '/images/categories/categories-07.png' },
  ];

  for (const cat of categoriesData) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { imageUrl: cat.imageUrl },
      create: cat,
    });
  }

  const catOrdi = await prisma.category.findUniqueOrThrow({ where: { slug: 'ordinateurs' } });
  const catPhone = await prisma.category.findUniqueOrThrow({ where: { slug: 'smartphones-tablettes' } });
  const catAcc = await prisma.category.findUniqueOrThrow({ where: { slug: 'accessoires-peripheriques' } });
  const catAudio = await prisma.category.findUniqueOrThrow({ where: { slug: 'audiovisuel' } });
  const catReseau = await prisma.category.findUniqueOrThrow({ where: { slug: 'reseau-connectivite' } });
  const catImprim = await prisma.category.findUniqueOrThrow({ where: { slug: 'imprimantes-scanners' } });

  // ─── Products ─────────────────────────────────────────────────────────────────
  const productsData = [
    {
      name: 'MacBook Pro 14" M3 Pro',
      reference: 'MBP-14-M3PRO',
      description: 'Apple MacBook Pro 14 pouces avec puce M3 Pro, 18 Go de mémoire unifiée, 512 Go SSD. Écran Liquid Retina XDR, autonomie jusqu\'à 17h.',
      price: 1450000,
      discountPrice: 1290000,
      stock: 5,
      categoryId: catOrdi.id,
      location: 'Abidjan - Cocody',
      images: [
        { url: '/images/products/product-1-bg-1.png', alt: 'MacBook Pro 14 M3 Pro', order: 0 },
        { url: '/images/products/product-1-sm-1.png', alt: 'MacBook Pro 14 M3 Pro miniature', order: 1 },
      ],
    },
    {
      name: 'HP EliteBook 840 G10',
      reference: 'HP-EB840-G10',
      description: 'Ordinateur portable professionnel HP EliteBook 840, Intel Core i7 13e gén., 16 Go RAM, 512 Go SSD, écran 14" FHD. Parfait pour les professionnels.',
      price: 750000,
      stock: 8,
      categoryId: catOrdi.id,
      location: 'Abidjan - Plateau',
      images: [
        { url: '/images/products/product-2-bg-1.png', alt: 'HP EliteBook 840', order: 0 },
        { url: '/images/products/product-2-sm-1.png', alt: 'HP EliteBook 840 miniature', order: 1 },
      ],
    },
    {
      name: 'iPhone 15 Pro Max 256 Go',
      reference: 'IPH-15PM-256',
      description: 'Apple iPhone 15 Pro Max en titane naturel. Puce A17 Pro, appareil photo 48 Mpx, zoom optique 5x. Écran Super Retina XDR 6,7".',
      price: 950000,
      stock: 6,
      categoryId: catPhone.id,
      location: 'Abidjan - Cocody',
      images: [
        { url: '/images/products/product-3-bg-1.png', alt: 'iPhone 15 Pro Max', order: 0 },
        { url: '/images/products/product-3-sm-1.png', alt: 'iPhone 15 Pro Max miniature', order: 1 },
      ],
    },
    {
      name: 'Samsung Galaxy S24 Ultra',
      reference: 'SAM-S24-ULTRA',
      description: 'Samsung Galaxy S24 Ultra 256 Go avec Galaxy AI. Écran Dynamic AMOLED 2X 6,8", S Pen intégré, appareil photo 200 Mpx.',
      price: 820000,
      discountPrice: 749000,
      stock: 10,
      categoryId: catPhone.id,
      location: 'Abidjan - Marcory',
      images: [
        { url: '/images/products/product-4-bg-1.png', alt: 'Samsung Galaxy S24 Ultra', order: 0 },
        { url: '/images/products/product-4-sm-1.png', alt: 'Samsung Galaxy S24 Ultra miniature', order: 1 },
      ],
    },
    {
      name: 'Casque Sony WH-1000XM5',
      reference: 'SONY-WH1000XM5',
      description: 'Casque sans fil premium avec réduction de bruit active leader du marché. Autonomie 30h, codec LDAC, confort exceptionnel.',
      price: 195000,
      discountPrice: 155000,
      stock: 15,
      categoryId: catAcc.id,
      location: 'Abidjan - Cocody',
      images: [
        { url: '/images/products/product-5-bg-1.png', alt: 'Sony WH-1000XM5', order: 0 },
        { url: '/images/products/product-5-sm-1.png', alt: 'Sony WH-1000XM5 miniature', order: 1 },
      ],
    },
    {
      name: 'Projecteur Epson EB-FH52',
      reference: 'EPS-EBFH52',
      description: 'Vidéoprojecteur Full HD 4000 lumens, connectivité Wi-Fi et Miracast. Idéal pour présentations et salles de conférence.',
      price: 480000,
      stock: 4,
      categoryId: catAudio.id,
      location: 'Abidjan - Plateau',
      images: [
        { url: '/images/products/product-6-bg-1.png', alt: 'Epson EB-FH52', order: 0 },
        { url: '/images/products/product-6-sm-1.png', alt: 'Epson EB-FH52 miniature', order: 1 },
      ],
    },
    {
      name: 'Switch Cisco SG350-28P',
      reference: 'CISCO-SG350-28P',
      description: 'Switch manageable 28 ports PoE+ Gigabit. Gestion avancée du réseau, sécurité intégrée, empilage simplifié.',
      price: 320000,
      stock: 7,
      categoryId: catReseau.id,
      location: 'Abidjan - Zone 4',
      images: [
        { url: '/images/products/product-7-bg-1.png', alt: 'Cisco SG350-28P', order: 0 },
        { url: '/images/products/product-7-sm-1.png', alt: 'Cisco SG350-28P miniature', order: 1 },
      ],
    },
    {
      name: 'Imprimante HP LaserJet Pro M404dn',
      reference: 'HP-LJ-M404DN',
      description: 'Imprimante laser monochrome rapide et fiable. Impression recto verso automatique, 40 ppm, réseau Ethernet.',
      price: 185000,
      stock: 12,
      categoryId: catImprim.id,
      location: 'Abidjan - Cocody',
      images: [
        { url: '/images/products/product-8-bg-1.png', alt: 'HP LaserJet Pro M404dn', order: 0 },
        { url: '/images/products/product-8-sm-1.png', alt: 'HP LaserJet Pro M404dn miniature', order: 1 },
      ],
    },
    {
      name: 'Dell Latitude 5540',
      reference: 'DELL-LAT5540',
      description: 'PC portable professionnel Dell Latitude 5540, Intel Core i5, 16 Go RAM, 256 Go SSD. Robuste et sécurisé pour l\'entreprise.',
      price: 620000,
      stock: 6,
      categoryId: catOrdi.id,
      location: 'Abidjan - Cocody',
      images: [
        { url: '/images/products/product-1-bg-2.png', alt: 'Dell Latitude 5540', order: 0 },
        { url: '/images/products/product-1-sm-2.png', alt: 'Dell Latitude 5540 miniature', order: 1 },
      ],
    },
    {
      name: 'iPad Pro 12.9" M2',
      reference: 'IPAD-PRO-129-M2',
      description: 'Apple iPad Pro 12,9 pouces avec puce M2, 128 Go. Écran Liquid Retina XDR, compatible Apple Pencil 2e gén.',
      price: 780000,
      stock: 4,
      categoryId: catPhone.id,
      location: 'Abidjan - Cocody',
      images: [
        { url: '/images/products/product-2-bg-2.png', alt: 'iPad Pro 12.9', order: 0 },
        { url: '/images/products/product-2-sm-2.png', alt: 'iPad Pro miniature', order: 1 },
      ],
    },
    {
      name: 'Souris Logitech MX Master 3S',
      reference: 'LOGI-MXM3S',
      description: 'Souris sans fil ergonomique haut de gamme. Capteur 8000 DPI, défilement MagSpeed, connexion multi-appareils.',
      price: 55000,
      stock: 20,
      categoryId: catAcc.id,
      location: 'Abidjan - Plateau',
      images: [
        { url: '/images/products/product-3-bg-2.png', alt: 'Logitech MX Master 3S', order: 0 },
        { url: '/images/products/product-3-sm-2.png', alt: 'Logitech MX Master 3S miniature', order: 1 },
      ],
    },
    {
      name: 'Clavier mécanique Keychron K8 Pro',
      reference: 'KEY-K8PRO',
      description: 'Clavier mécanique sans fil TKL, switches Gateron G Pro, rétroéclairage RGB, compatible Mac/Windows.',
      price: 68000,
      stock: 14,
      categoryId: catAcc.id,
      location: 'Abidjan - Cocody',
      images: [
        { url: '/images/products/product-4-bg-2.png', alt: 'Keychron K8 Pro', order: 0 },
        { url: '/images/products/product-4-sm-2.png', alt: 'Keychron K8 Pro miniature', order: 1 },
      ],
    },
  ];

  for (const p of productsData) {
    const slug = slugify(p.name);
    const existing = await prisma.product.findUnique({ where: { reference: p.reference } });
    if (existing) continue;

    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug,
        reference: p.reference,
        description: p.description,
        price: p.price,
        discountPrice: ('discountPrice' in p && p.discountPrice) ? p.discountPrice : null,
        stock: p.stock,
        status: ProductStatus.AVAILABLE,
        categoryId: p.categoryId,
        location: p.location,
        images: {
          create: p.images.map((img) => ({
            url: img.url,
            alt: img.alt,
            order: img.order,
          })),
        },
      },
    });

    await prisma.productMovement.create({
      data: {
        productId: product.id,
        type: ProductMovementType.IN,
        quantity: p.stock,
        note: 'Stock initial seed',
      },
    });
  }

  // ─── Blog Posts ───────────────────────────────────────────────────────────────
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });

  const postsData = [
    {
      title: 'Comment choisir son ordinateur portable en 2026',
      excerpt: 'Guide complet pour bien choisir votre PC portable selon vos besoins : bureautique, création, gaming ou professionnel.',
      content: `<p>Choisir un ordinateur portable peut être complexe avec toutes les options disponibles. Voici les critères essentiels à considérer.</p>
<h3>1. Définissez votre usage</h3>
<p>Pour la bureautique, un processeur Core i5 et 8 Go de RAM suffisent. Pour la création de contenu ou le gaming, visez un Core i7/i9 avec 16 Go minimum et une carte graphique dédiée.</p>
<h3>2. L'écran</h3>
<p>Un écran Full HD (1920x1080) est le minimum recommandé. Les créatifs préféreront un écran OLED ou mini-LED avec une bonne couverture colorimétrique.</p>
<h3>3. L'autonomie</h3>
<p>Pour un usage nomade, visez au minimum 8h d'autonomie. Les MacBook et certains ultrabooks excellent dans ce domaine.</p>
<h3>4. Le budget</h3>
<p>À Abidjan, comptez entre 300 000 FCFA pour un entrée de gamme correct et plus de 1 500 000 FCFA pour le haut de gamme. Chez Kaniê, nous vous conseillons la meilleure option selon votre budget.</p>`,
      coverImage: '/images/blog/blog-01.jpg',
      status: ContentStatus.PUBLISHED,
    },
    {
      title: 'Les avantages du matériel reconditionné',
      excerpt: 'Économisez jusqu\'à 50% sur du matériel informatique de qualité grâce au reconditionné.',
      content: `<p>Le matériel reconditionné offre une alternative économique et écologique aux produits neufs.</p>
<h3>Qu'est-ce que le reconditionné ?</h3>
<p>Un appareil reconditionné a été vérifié, réparé si nécessaire, nettoyé et remis en état de fonctionnement par des professionnels certifiés.</p>
<h3>Les avantages</h3>
<ul>
<li>Économies de 30 à 50% par rapport au neuf</li>
<li>Impact environnemental réduit</li>
<li>Garantie incluse</li>
<li>Performances identiques au neuf</li>
</ul>
<p>Chez Kaniê, nous proposons une sélection de produits reconditionnés avec garantie 12 mois.</p>`,
      coverImage: '/images/blog/blog-02.jpg',
      status: ContentStatus.PUBLISHED,
    },
    {
      title: 'Sécuriser votre réseau d\'entreprise : les bonnes pratiques',
      excerpt: 'Protégez votre infrastructure réseau contre les cybermenaces avec ces conseils essentiels.',
      content: `<p>La sécurité réseau est devenue une priorité absolue pour les entreprises en Côte d'Ivoire.</p>
<h3>Pare-feu et segmentation</h3>
<p>Installez un pare-feu nouvelle génération (NGFW) et segmentez votre réseau pour isoler les données sensibles.</p>
<h3>Mises à jour régulières</h3>
<p>Maintenez vos équipements et logiciels à jour pour corriger les failles de sécurité connues.</p>
<h3>Formation des employés</h3>
<p>90% des cyberattaques commencent par du phishing. Formez vos équipes à reconnaître les menaces.</p>
<p>Kaniê propose des audits réseau et des solutions de sécurité adaptées aux PME ivoiriennes.</p>`,
      coverImage: '/images/blog/blog-03.jpg',
      status: ContentStatus.PUBLISHED,
    },
    {
      title: '5 tendances tech à suivre en 2026',
      excerpt: 'Intelligence artificielle, réalité augmentée, cloud souverain... Découvrez les technologies qui transforment le marché.',
      content: `<p>Le marché technologique africain évolue rapidement. Voici les tendances qui impactent les entreprises ivoiriennes.</p>
<h3>1. L'IA générative en entreprise</h3>
<p>L'intelligence artificielle s'intègre dans les outils bureautiques et métier, augmentant la productivité.</p>
<h3>2. Le cloud souverain</h3>
<p>Les entreprises privilégient des solutions cloud hébergées localement pour la conformité et les performances.</p>
<h3>3. La cybersécurité zero-trust</h3>
<p>Le modèle "ne jamais faire confiance, toujours vérifier" devient la norme.</p>
<h3>4. L'IoT industriel</h3>
<p>Les capteurs connectés optimisent la gestion des bâtiments et de la logistique.</p>
<h3>5. La vidéoconférence immersive</h3>
<p>Les salles de réunion hybrides deviennent la norme avec des solutions vidéo avancées.</p>`,
      coverImage: '/images/blog/blog-04.jpg',
      status: ContentStatus.PUBLISHED,
    },
    {
      title: 'Installer une salle de conférence professionnelle',
      excerpt: 'Tout ce qu\'il faut savoir pour équiper une salle de visioconférence performante dans votre entreprise.',
      content: `<p>Une salle de conférence bien équipée est essentielle pour le travail collaboratif moderne.</p>
<h3>L'écran</h3>
<p>Optez pour un écran interactif de 65" ou 75" selon la taille de la salle, ou un vidéoprojecteur laser pour les grandes salles.</p>
<h3>L'audio</h3>
<p>Un système de micros plafonniers couplé à des enceintes de qualité garantit une communication claire pour tous les participants.</p>
<h3>La caméra</h3>
<p>Choisissez une caméra PTZ 4K avec cadrage automatique pour les réunions hybrides.</p>
<p>Kaniê conçoit et installe des salles de conférence clés en main adaptées à votre espace et vos besoins.</p>`,
      coverImage: '/images/blog/blog-05.jpg',
      status: ContentStatus.PUBLISHED,
    },
    {
      title: 'Guide d\'achat : les meilleurs accessoires bureautiques',
      excerpt: 'Améliorez votre confort et productivité avec les bons accessoires de bureau.',
      content: `<p>Un bon poste de travail passe aussi par les accessoires qui vous accompagnent au quotidien.</p>
<h3>Écran externe</h3>
<p>Un écran 27" QHD minimum transforme votre productivité. Pour les créatifs, un 32" 4K est recommandé.</p>
<h3>Clavier et souris ergonomiques</h3>
<p>Investir dans un bon clavier mécanique et une souris ergonomique réduit la fatigue et prévient les TMS.</p>
<h3>Station d'accueil</h3>
<p>Un seul câble pour tout connecter : écran, clavier, souris, réseau, stockage.</p>
<p>Découvrez notre sélection d'accessoires dans la boutique Kaniê.</p>`,
      coverImage: '/images/blog/blog-06.jpg',
      status: ContentStatus.PUBLISHED,
    },
  ];

  for (const post of postsData) {
    const slug = slugify(post.title);
    const existing = await prisma.post.findUnique({ where: { slug } });
    if (existing) continue;

    await prisma.post.create({
      data: {
        title: post.title,
        slug,
        excerpt: post.excerpt,
        content: post.content,
        coverImage: post.coverImage,
        status: post.status,
        authorId: admin.id,
        publishedAt: new Date(),
      },
    });
  }

  // ─── Projects (Réalisations) ──────────────────────────────────────────────────
  const projectsData = [
    {
      title: 'Installation salle de conférence — Banque Atlantique',
      description: 'Conception et installation d\'une salle de conférence 20 places avec système de visioconférence Poly, écran interactif 86", sonorisation professionnelle et câblage structuré.',
      coverImage: '/images/blog/blog-07.jpg',
      clientName: 'Banque Atlantique',
      status: ContentStatus.PUBLISHED,
    },
    {
      title: 'Déploiement réseau — Hôtel Ivoire Sofitel',
      description: 'Migration complète de l\'infrastructure réseau : 500+ points d\'accès Wi-Fi 6, switches PoE, pare-feu Fortinet et monitoring centralisé pour couvrir l\'ensemble de l\'établissement.',
      coverImage: '/images/blog/blog-08.jpg',
      clientName: 'Sofitel Hôtel Ivoire',
      status: ContentStatus.PUBLISHED,
    },
    {
      title: 'Studio d\'enregistrement — RTI',
      description: 'Aménagement acoustique et installation technique d\'un studio d\'enregistrement broadcast : console de mixage numérique, système d\'écoute calibré, traitement acoustique.',
      coverImage: '/images/blog/blog-09.jpg',
      clientName: 'RTI',
      status: ContentStatus.PUBLISHED,
    },
    {
      title: 'Parc informatique — Ministère de l\'Éducation',
      description: 'Fourniture et déploiement de 200 ordinateurs HP pour les lycées d\'excellence, incluant l\'installation, la configuration et la formation des techniciens sur site.',
      coverImage: '/images/blog/blog-details-01.jpg',
      clientName: 'Ministère de l\'Éducation Nationale',
      status: ContentStatus.PUBLISHED,
    },
  ];

  for (const project of projectsData) {
    const slug = slugify(project.title);
    const existing = await prisma.project.findUnique({ where: { slug } });
    if (existing) continue;

    await prisma.project.create({
      data: {
        title: project.title,
        slug,
        description: project.description,
        coverImage: project.coverImage,
        clientName: project.clientName,
        status: project.status,
        completedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // ─── Courses (Formations - Académie) ──────────────────────────────────────────
  const coursesData = [
    {
      title: 'Initiation à l\'informatique',
      description: 'Formation pour débutants : maîtrisez les bases de l\'ordinateur, Windows, la navigation internet et la bureautique (Word, Excel, PowerPoint).',
      duration: '20h (4 semaines)',
      level: 'Débutant',
      coverImage: '/images/blog/blog-01.jpg',
      status: ContentStatus.PUBLISHED,
    },
    {
      title: 'Administration réseau Cisco',
      description: 'Préparez la certification CCNA : configuration de routeurs et switches, VLAN, protocoles de routage, sécurité réseau et dépannage.',
      duration: '40h (8 semaines)',
      level: 'Intermédiaire',
      coverImage: '/images/blog/blog-02.jpg',
      status: ContentStatus.PUBLISHED,
    },
    {
      title: 'Maintenance et dépannage PC',
      description: 'Apprenez à diagnostiquer, réparer et maintenir les ordinateurs : hardware, logiciel, récupération de données, virus et sécurité.',
      duration: '30h (6 semaines)',
      level: 'Débutant',
      coverImage: '/images/blog/blog-03.jpg',
      status: ContentStatus.PUBLISHED,
    },
    {
      title: 'Montage vidéo avec DaVinci Resolve',
      description: 'Maîtrisez le montage vidéo professionnel : import, montage, étalonnage, effets spéciaux, mixage audio et export pour différents supports.',
      duration: '35h (7 semaines)',
      level: 'Intermédiaire',
      coverImage: '/images/blog/blog-04.jpg',
      status: ContentStatus.PUBLISHED,
    },
    {
      title: 'Cybersécurité pour les entreprises',
      description: 'Sensibilisation et formation pratique : identification des menaces, bonnes pratiques, gestion des incidents, conformité RGPD.',
      duration: '15h (3 semaines)',
      level: 'Avancé',
      coverImage: '/images/blog/blog-05.jpg',
      status: ContentStatus.PUBLISHED,
    },
  ];

  for (const course of coursesData) {
    const slug = slugify(course.title);
    const existing = await prisma.course.findUnique({ where: { slug } });
    if (existing) continue;

    await prisma.course.create({
      data: {
        title: course.title,
        slug,
        description: course.description,
        duration: course.duration,
        level: course.level,
        coverImage: course.coverImage,
        status: course.status,
        publishedAt: new Date(),
      },
    });
  }

  // ─── Testimonials ─────────────────────────────────────────────────────────────
  const testimonialsData = [
    {
      authorName: 'Koné Amadou',
      company: 'DG Finances Plus',
      content: 'Kaniê a équipé nos 3 agences en matériel informatique. Service impeccable, livraison rapide et le SAV est très réactif. Je recommande vivement.',
      rating: 5,
    },
    {
      authorName: 'Diabaté Mariam',
      company: 'Studio Créatif ABJ',
      content: 'L\'installation de notre studio d\'enregistrement par l\'équipe Kaniê a dépassé nos attentes. Qualité professionnelle et respect des délais.',
      rating: 5,
    },
    {
      authorName: 'Traoré Ibrahim',
      company: 'Hôtel Palm Club',
      content: 'Le déploiement Wi-Fi dans notre hôtel fonctionne parfaitement depuis 1 an. Nos clients sont satisfaits de la couverture et de la vitesse.',
      rating: 4,
    },
    {
      authorName: 'Yao Christelle',
      company: 'Cabinet Juridique CY',
      content: 'Formation bureautique excellente pour mon équipe. Les formateurs sont patients et pédagogues. Notre productivité a augmenté de 40%.',
      rating: 5,
    },
  ];

  const existingTestimonials = await prisma.testimonial.count();
  if (existingTestimonials === 0) {
    for (const t of testimonialsData) {
      await prisma.testimonial.create({ data: t });
    }
  }

  // ─── Homepage banners ─────────────────────────────────────────────────────────
  const homepageBanners = [
    {
      slot: HomepageBannerSlot.MAIN,
      tagline: 'Équipements informatiques',
      title: "JUSQU'À 30% DE RÉDUCTION",
      description:
        "Découvrez notre sélection d'ordinateurs portables, desktops et accessoires aux meilleurs prix d'Abidjan.",
      imageUrl: '/images/promo/promo-01.png',
      linkUrl: '/boutique',
      buttonLabel: 'Acheter maintenant',
      bgColor: '#F5F2EE',
      buttonStyle: HomepageBannerButtonStyle.PRIMARY,
      textAlign: HomepageBannerTextAlign.LEFT,
      imageSide: HomepageBannerImageSide.RIGHT,
      isActive: true,
    },
    {
      slot: HomepageBannerSlot.GRID_LEFT,
      tagline: 'Services audiovisuels',
      title: 'Solutions sur mesure personnalisées',
      highlightText: '-20% sur votre 1er projet',
      imageUrl: '/images/promo/promo-02.png',
      linkUrl: '/services',
      buttonLabel: 'Découvrir',
      bgColor: '#FDF5E6',
      buttonStyle: HomepageBannerButtonStyle.TEAL,
      textAlign: HomepageBannerTextAlign.RIGHT,
      imageSide: HomepageBannerImageSide.LEFT,
      isActive: true,
    },
    {
      slot: HomepageBannerSlot.GRID_RIGHT,
      tagline: 'Académie Kaniê',
      title: "Jusqu'à 40% de réduction",
      description:
        'Formations en marketing digital, montage vidéo, infographie et plus encore.',
      imageUrl: '/images/promo/promo-03.png',
      linkUrl: '/academie',
      buttonLabel: "S'inscrire",
      bgColor: '#FAEACA',
      buttonStyle: HomepageBannerButtonStyle.ORANGE,
      textAlign: HomepageBannerTextAlign.LEFT,
      imageSide: HomepageBannerImageSide.RIGHT,
      isActive: true,
    },
    {
      slot: HomepageBannerSlot.HERO_CARD_TOP,
      tagline: 'Offre limitée',
      title: 'Ordinateurs portables & desktops',
      imageUrl: '/images/hero/hero-02.png',
      linkUrl: '/boutique',
      buttonLabel: 'Voir',
      bgColor: '#E8F4FD',
      priceAmount: 350000,
      originalPriceAmount: 500000,
      buttonStyle: HomepageBannerButtonStyle.PRIMARY,
      textAlign: HomepageBannerTextAlign.LEFT,
      imageSide: HomepageBannerImageSide.RIGHT,
      isActive: true,
    },
    {
      slot: HomepageBannerSlot.HERO_CARD_BOTTOM,
      tagline: 'Offre limitée',
      title: 'Accessoires & périphériques',
      imageUrl: '/images/hero/hero-01.png',
      linkUrl: '/boutique',
      buttonLabel: 'Voir',
      bgColor: '#E6F9F1',
      priceAmount: 25000,
      originalPriceAmount: 45000,
      buttonStyle: HomepageBannerButtonStyle.PRIMARY,
      textAlign: HomepageBannerTextAlign.LEFT,
      imageSide: HomepageBannerImageSide.RIGHT,
      isActive: true,
    },
  ];

  for (const banner of homepageBanners) {
    await prisma.homepageBanner.upsert({
      where: { slot: banner.slot },
      update: {},
      create: banner,
    });
  }

  // ─── Summary ──────────────────────────────────────────────────────────────────
  const counts = {
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    posts: await prisma.post.count(),
    projects: await prisma.project.count(),
    courses: await prisma.course.count(),
    testimonials: await prisma.testimonial.count(),
    homepageBanners: await prisma.homepageBanner.count(),
  };

  console.log('✅ Seed terminé !');
  console.log(`   Admin: ${adminEmail} / ${adminPassword}`);
  console.log(`   Client test: client@test.ci / Client123!`);
  console.log(`   ${counts.categories} catégories`);
  console.log(`   ${counts.products} produits`);
  console.log(`   ${counts.posts} articles de blog`);
  console.log(`   ${counts.projects} réalisations`);
  console.log(`   ${counts.courses} formations`);
  console.log(`   ${counts.testimonials} témoignages`);
  console.log(`   ${counts.homepageBanners} bannières accueil`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
