// Public historical profiles only. Assignment never depends on hidden army ranks.
import { randomInt } from './random.mjs';
export const COMMANDERS = [
	{
		"id": "abraham-lincoln",
		"displayName": "Lincoln",
		"fullName": "Abraham Lincoln",
		"side": "Union",
		"role": "President",
		"sourceUrl": "https://www.archives.gov/milestone-documents/emancipation-proclamation",
		"sourceUrls": [
			"https://www.nps.gov/civilwar/overview.htm",
			"https://www.archives.gov/milestone-documents/emancipation-proclamation"
		],
		"profile": "U.S. president during the Civil War, directing the effort to preserve the Union.",
		"battleExample": "His 1863 Emancipation Proclamation declared enslaved people free in designated rebellious areas and authorized Black military service.",
		"description": "He was a U.S. president during the Civil War, directing the effort to preserve the Union; his 1863 Emancipation Proclamation declared enslaved people free in designated rebellious areas and authorized Black military service."
	},
	{
		"id": "ulysses-s-grant",
		"displayName": "Grant",
		"fullName": "Ulysses S. Grant",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://home.nps.gov/articles/000/grant-at-vicksburg.htm",
		"sourceUrls": [
			"https://www.nps.gov/civilwar/overview.htm",
			"https://home.nps.gov/articles/000/grant-at-vicksburg.htm"
		],
		"profile": "Union general who led the campaign to capture Vicksburg on the Mississippi River.",
		"battleExample": "After direct assaults failed in 1863, he used a siege to force Vicksburg to surrender.",
		"description": "He was a Union general who led the campaign to capture Vicksburg on the Mississippi River; after direct assaults failed in 1863, he used a siege to force Vicksburg to surrender."
	},
	{
		"id": "william-tecumseh-sherman",
		"displayName": "Sherman",
		"fullName": "William Tecumseh Sherman",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/fosu/learn/historyculture/william-t-sherman.htm",
		"sourceUrls": [
			"https://www.nps.gov/vick/learn/historyculture/william-tecumseh-sherman.htm",
			"https://www.nps.gov/fosu/learn/historyculture/william-t-sherman.htm"
		],
		"profile": "Union general who commanded major campaigns in Georgia and the Carolinas.",
		"battleExample": "His 1864 March to the Sea targeted Confederate supplies and communications, also devastating civilian communities.",
		"description": "He was a Union general who commanded major campaigns in Georgia and the Carolinas; his 1864 March to the Sea targeted Confederate supplies and communications, also devastating civilian communities."
	},
	{
		"id": "philip-henry-sheridan",
		"displayName": "Sheridan",
		"fullName": "Philip Henry Sheridan",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://home.nps.gov/people/philip-sheridan.htm",
		"sourceUrls": [
			"https://home.nps.gov/people/philip-sheridan.htm"
		],
		"profile": "Union cavalry leader and commander of the Army of the Shenandoah.",
		"battleExample": "At Cedar Creek in 1864, he rallied retreating troops and led a counterattack.",
		"description": "He was a Union cavalry leader and commander of the Army of the Shenandoah; at Cedar Creek in 1864, he rallied retreating troops and led a counterattack."
	},
	{
		"id": "george-henry-thomas",
		"displayName": "Thomas",
		"fullName": "George Henry Thomas",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/chch/learn/news/thomasdiscussionpanel.htm",
		"sourceUrls": [
			"https://www.nps.gov/articles/000/civil-war-general-busts.htm",
			"https://www.nps.gov/chch/learn/news/thomasdiscussionpanel.htm"
		],
		"profile": "Virginia-born Union general who fought mainly in the Western Theater.",
		"battleExample": "His defense at Chickamauga in 1863 helped other Union troops retreat to Chattanooga.",
		"description": "He was a Virginia-born Union general who fought mainly in the Western Theater; his defense at Chickamauga in 1863 helped other Union troops retreat to Chattanooga."
	},
	{
		"id": "james-birdseye-mcpherson",
		"displayName": "McPherson",
		"fullName": "James Birdseye McPherson",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/vick/learn/historyculture/james-birdseye-mcpherson.htm",
		"sourceUrls": [
			"https://www.nps.gov/articles/000/civil-war-general-busts.htm",
			"https://www.nps.gov/vick/learn/historyculture/james-birdseye-mcpherson.htm"
		],
		"profile": "Engineer and Union general who commanded the Army of the Tennessee in 1864.",
		"battleExample": "His XVII Corps dug siege approaches and fought around Vicksburg in 1863.",
		"description": "He was an engineer and Union general who commanded the Army of the Tennessee in 1864; his XVII Corps dug siege approaches and fought around Vicksburg in 1863."
	},
	{
		"id": "edward-otho-cresap-ord",
		"displayName": "Ord",
		"fullName": "Edward Otho Cresap Ord",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/apco/learn/education/final-battles.htm",
		"sourceUrls": [
			"https://www.loc.gov/item/2013647721/",
			"https://www.nps.gov/apco/learn/education/final-battles.htm"
		],
		"profile": "Union general commanding the Army of the James near the end of the war.",
		"battleExample": "At Appomattox in 1865, his infantry helped block Lee's western escape route.",
		"description": "He was a Union general commanding the Army of the James near the end of the war; at Appomattox in 1865, his infantry helped block Lee's western escape route."
	},
	{
		"id": "george-brinton-mcclellan",
		"displayName": "McClellan",
		"fullName": "George Brinton McClellan",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/people/george-brinton-mcclellan.htm",
		"sourceUrls": [
			"https://www.nps.gov/people/george-brinton-mcclellan.htm"
		],
		"profile": "Union general who commanded the Army of the Potomac during the 1862 Maryland Campaign.",
		"battleExample": "At Antietam, he held a substantial reserve and did not renew the attack the next day.",
		"description": "He was a Union general who commanded the Army of the Potomac during the 1862 Maryland Campaign; at Antietam, he held a substantial reserve and did not renew the attack the next day."
	},
	{
		"id": "george-gordon-meade",
		"displayName": "Meade",
		"fullName": "George Gordon Meade",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://home.nps.gov/places/000/george-gordon-meade-memorial.htm",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/union-commanders-at-gettysburg.htm",
			"https://home.nps.gov/places/000/george-gordon-meade-memorial.htm"
		],
		"profile": "Union commander of the Army of the Potomac from 1863 to 1865.",
		"battleExample": "Taking command shortly before Gettysburg, he led the army that defeated Lee there.",
		"description": "He was a Union commander of the Army of the Potomac from 1863 to 1865; taking command shortly before Gettysburg, he led the army that defeated Lee there."
	},
	{
		"id": "ambrose-everett-burnside",
		"displayName": "Burnside",
		"fullName": "Ambrose Everett Burnside",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/anti/planyourvisit/union-advance-trail-guide-stop-1.htm",
		"sourceUrls": [
			"https://www.nps.gov/articles/leading-the-charge.htm",
			"https://www.nps.gov/anti/planyourvisit/union-advance-trail-guide-stop-1.htm"
		],
		"profile": "Union general who led the IX Corps at Antietam and later the Army of the Potomac.",
		"battleExample": "At Antietam in 1862, he combined bridge attacks with a downstream flanking movement.",
		"description": "He was a Union general who led the IX Corps at Antietam and later the Army of the Potomac; at Antietam in 1862, he combined bridge attacks with a downstream flanking movement."
	},
	{
		"id": "joseph-hooker",
		"displayName": "Hooker",
		"fullName": "Joseph Hooker",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/civilwar/search-battles-detail.htm?battleCode=va032",
		"sourceUrls": [
			"https://www.nps.gov/articles/leading-the-charge.htm",
			"https://www.nps.gov/civilwar/search-battles-detail.htm?battleCode=va032"
		],
		"profile": "Union general who led the Army of the Potomac during the Chancellorsville Campaign.",
		"battleExample": "In 1863, he crossed rivers above Fredericksburg to try to turn Lee's left flank.",
		"description": "He was a Union general who led the Army of the Potomac during the Chancellorsville Campaign; in 1863, he crossed rivers above Fredericksburg to try to turn Lee's left flank."
	},
	{
		"id": "john-buford",
		"displayName": "Buford",
		"fullName": "John Buford",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/gett/learn/historyculture/union-commanders-at-gettysburg.htm",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/union-commanders-at-gettysburg.htm"
		],
		"profile": "Union cavalry division commander at Gettysburg.",
		"battleExample": "He chose to hold near Gettysburg, setting the stage for the battle on July 1, 1863.",
		"description": "He was a Union cavalry division commander at Gettysburg; he chose to hold near Gettysburg, setting the stage for the battle on July 1, 1863."
	},
	{
		"id": "john-fulton-reynolds",
		"displayName": "Reynolds",
		"fullName": "John Fulton Reynolds",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/articles/000/federals-gettysburg.htm",
		"sourceUrls": [
			"https://www.nps.gov/articles/000/six-unusual-abraham-lincoln-facts-and-rumors-part-ii.htm",
			"https://www.nps.gov/articles/000/federals-gettysburg.htm"
		],
		"profile": "Union general commanding the I Corps.",
		"battleExample": "At Gettysburg on July 1, 1863, he brought infantry forward and was killed directing a counterattack.",
		"description": "He was a Union general commanding the I Corps; at Gettysburg on July 1, 1863, he brought infantry forward and was killed directing a counterattack."
	},
	{
		"id": "abner-doubleday",
		"displayName": "Doubleday",
		"fullName": "Abner Doubleday",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/gett/learn/historyculture/union-commanders-at-gettysburg.htm",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/union-commanders-at-gettysburg.htm"
		],
		"profile": "Union general who took over I Corps after Reynolds was killed.",
		"battleExample": "At Gettysburg in 1863, his troops held west of Seminary Ridge before retreating.",
		"description": "He was a Union general who took over I Corps after Reynolds was killed; at Gettysburg in 1863, his troops held west of Seminary Ridge before retreating."
	},
	{
		"id": "winfield-scott-hancock",
		"displayName": "Hancock",
		"fullName": "Winfield Scott Hancock",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/articles/000/federals-gettysburg.htm",
		"sourceUrls": [
			"https://www.nps.gov/articles/000/six-unusual-abraham-lincoln-facts-and-rumors-part-ii.htm",
			"https://www.nps.gov/articles/000/federals-gettysburg.htm"
		],
		"profile": "Union general who helped direct the defense at Gettysburg.",
		"battleExample": "On July 2, 1863, he sent reinforcements to threatened parts of the Union line.",
		"description": "He was a Union general who helped direct the defense at Gettysburg; On July 2, 1863, he sent reinforcements to threatened parts of the Union line."
	},
	{
		"id": "oliver-otis-howard",
		"displayName": "Howard",
		"fullName": "Oliver Otis Howard",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/articles/000/federals-gettysburg.htm",
		"sourceUrls": [
			"https://www.nps.gov/articles/000/federals-gettysburg.htm"
		],
		"profile": "Union general who commanded XI Corps at Gettysburg.",
		"battleExample": "On July 1, 1863, he secured Cemetery Hill as a Union defensive position.",
		"description": "He was a Union general who commanded XI Corps at Gettysburg; On July 1, 1863, he secured Cemetery Hill as a Union defensive position."
	},
	{
		"id": "henry-jackson-hunt",
		"displayName": "Hunt",
		"fullName": "Henry Jackson Hunt",
		"side": "Union",
		"role": "General / artillery chief",
		"sourceUrl": "https://www.nps.gov/gett/learn/historyculture/union-commanders-at-gettysburg.htm",
		"sourceUrls": [
			"https://www.nps.gov/articles/000/causes_of_deafness_during_civil_war.htm",
			"https://www.nps.gov/gett/learn/historyculture/union-commanders-at-gettysburg.htm"
		],
		"profile": "Union artillery chief at Gettysburg.",
		"battleExample": "He coordinated Union batteries during the Confederate attacks of July 2 and 3, 1863.",
		"description": "He was a Union artillery chief at Gettysburg; he coordinated Union batteries during the Confederate attacks of July 2 and 3, 1863."
	},
	{
		"id": "daniel-edgar-sickles",
		"displayName": "Sickles",
		"fullName": "Daniel Edgar Sickles",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/articles/000/federals-gettysburg.htm",
		"sourceUrls": [
			"https://findingaids.loc.gov/repositories/19/resources/4745",
			"https://www.nps.gov/articles/000/federals-gettysburg.htm"
		],
		"profile": "Union general commanding III Corps at Gettysburg.",
		"battleExample": "His forward move on July 2, 1863, exposed his corps to heavy fighting.",
		"description": "He was a Union general commanding III Corps at Gettysburg; his forward move on July 2, 1863, exposed his corps to heavy fighting."
	},
	{
		"id": "gouverneur-kemble-warren",
		"displayName": "Warren",
		"fullName": "Gouverneur Kemble Warren",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://home.nps.gov/places/gettysburg-then-now-warren.htm",
		"sourceUrls": [
			"https://www.nps.gov/people/gouverneur-warren.htm",
			"https://home.nps.gov/places/gettysburg-then-now-warren.htm"
		],
		"profile": "Union general and the Army of the Potomac's chief engineer at Gettysburg.",
		"battleExample": "Seeing the danger to Little Round Top, he directed troops to defend the hill.",
		"description": "He was a Union general and the Army of the Potomac's chief engineer at Gettysburg; seeing the danger to Little Round Top, he directed troops to defend the hill."
	},
	{
		"id": "joshua-lawrence-chamberlain",
		"displayName": "Chamberlain",
		"fullName": "Joshua Lawrence Chamberlain",
		"side": "Union",
		"role": "Colonel at Gettysburg; later general",
		"sourceUrl": "https://findingaids.loc.gov/repositories/19/resources/4407",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/union-commanders-at-gettysburg.htm",
			"https://findingaids.loc.gov/repositories/19/resources/4407"
		],
		"profile": "Commander of the 20th Maine, later promoted to brigadier general.",
		"battleExample": "At Gettysburg in 1863, his regiment defended Little Round Top.",
		"description": "He was a commander of the 20th Maine, later promoted to brigadier general; at Gettysburg in 1863, his regiment defended Little Round Top."
	},
	{
		"id": "george-armstrong-custer",
		"displayName": "Custer",
		"fullName": "George Armstrong Custer",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://home.nps.gov/people/george-armstrong-custer.htm",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/union-commanders-at-gettysburg.htm",
			"https://home.nps.gov/people/george-armstrong-custer.htm"
		],
		"profile": "Union cavalry general who commanded the Michigan Brigade in 1863.",
		"battleExample": "He led cavalry charges at Gettysburg on July 3, 1863.",
		"description": "He was a Union cavalry general who commanded the Michigan Brigade in 1863; he led cavalry charges at Gettysburg on July 3, 1863."
	},
	{
		"id": "alexander-stewart-webb",
		"displayName": "Webb",
		"fullName": "Alexander Stewart Webb",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/gett/learn/historyculture/union-commanders-at-gettysburg.htm",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/union-commanders-at-gettysburg.htm"
		],
		"profile": "Union general commanding the Philadelphia Brigade.",
		"battleExample": "At Gettysburg in 1863, his troops helped repel the Confederate breakthrough at the Angle.",
		"description": "He was a Union general commanding the Philadelphia Brigade; at Gettysburg in 1863, his troops helped repel the Confederate breakthrough at the Angle."
	},
	{
		"id": "william-starke-rosecrans",
		"displayName": "Rosecrans",
		"fullName": "William Starke Rosecrans",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/people/william-rosecrans.htm",
		"sourceUrls": [
			"https://www.nps.gov/people/william-rosecrans.htm"
		],
		"profile": "Union army commander who led the Army of the Cumberland.",
		"battleExample": "In 1863, his army pushed Confederates from middle Tennessee before its defeat at Chickamauga.",
		"description": "He was a Union army commander who led the Army of the Cumberland; in 1863, his army pushed Confederates from middle Tennessee before its defeat at Chickamauga."
	},
	{
		"id": "don-carlos-buell",
		"displayName": "Buell",
		"fullName": "Don Carlos Buell",
		"side": "Union",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/cane/highest-praise-the-army-of-the-ohio-at-shiloh.htm",
		"sourceUrls": [
			"https://www.nps.gov/cane/highest-praise-the-army-of-the-ohio-at-shiloh.htm"
		],
		"profile": "Union general commanding the Army of the Ohio in 1862.",
		"battleExample": "His reinforcements at Shiloh helped Grant counterattack on the battle's second day.",
		"description": "He was a Union general commanding the Army of the Ohio in 1862; his reinforcements at Shiloh helped Grant counterattack on the battle's second day."
	},
	{
		"id": "robert-edward-lee",
		"displayName": "Robert E. Lee",
		"fullName": "Robert Edward Lee",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://home.nps.gov/arho/learn/historyculture/robert-lee.htm",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm",
			"https://home.nps.gov/arho/learn/historyculture/robert-lee.htm"
		],
		"profile": "Lee commanded the Confederate Army of Northern Virginia.",
		"battleExample": "He surrendered that army to Ulysses S. Grant at Appomattox Court House on April 9, 1865.",
		"description": "Lee commanded the Confederate Army of Northern Virginia; he surrendered that army to Ulysses S. Grant at Appomattox Court House on April 9, 1865."
	},
	{
		"id": "james-longstreet",
		"displayName": "Longstreet",
		"fullName": "James Longstreet",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://home.nps.gov/people/james-longstreet.htm",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm",
			"https://home.nps.gov/people/james-longstreet.htm"
		],
		"profile": "Longstreet commanded the First Corps of the Confederate Army of Northern Virginia.",
		"battleExample": "His troops attacked the Union flank at the Second Battle of Manassas in 1862.",
		"description": "Longstreet commanded the First Corps of the Confederate Army of Northern Virginia; his troops attacked the Union flank at the Second Battle of Manassas in 1862."
	},
	{
		"id": "richard-stoddert-ewell",
		"displayName": "Ewell",
		"fullName": "Richard Stoddert Ewell",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://home.nps.gov/people/richard-s-ewell.htm",
		"sourceUrls": [
			"https://www.nps.gov/people/richard-stoddert-ewell.htm",
			"https://home.nps.gov/people/richard-s-ewell.htm"
		],
		"profile": "Ewell became a Confederate corps commander after Thomas Jackson's death in 1863.",
		"battleExample": "He commanded Confederate forces at the Second Battle of Winchester during the Gettysburg Campaign.",
		"description": "Ewell became a Confederate corps commander after Thomas Jackson's death in 1863; he commanded Confederate forces at the Second Battle of Winchester during the Gettysburg Campaign."
	},
	{
		"id": "ambrose-powell-hill",
		"displayName": "A. P. Hill",
		"fullName": "Ambrose Powell Hill",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://home.nps.gov/people/ambrose-powell-hill.htm",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm",
			"https://home.nps.gov/people/ambrose-powell-hill.htm"
		],
		"profile": "Hill led the Confederate Light Division and later the Third Corps.",
		"battleExample": "His division marched from Harpers Ferry to counter a Union advance at Antietam in 1862.",
		"description": "Hill led the Confederate Light Division and later the Third Corps; his division marched from Harpers Ferry to counter a Union advance at Antietam in 1862."
	},
	{
		"id": "henry-heth",
		"displayName": "Heth",
		"fullName": "Henry Heth",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm"
		],
		"profile": "Heth led Confederate troops in Lee's Army of Northern Virginia.",
		"battleExample": "His troops opened the Confederate fighting at Gettysburg on July 1, 1863.",
		"description": "Heth led Confederate troops in Lee's Army of Northern Virginia; his troops opened the Confederate fighting at Gettysburg on July 1, 1863."
	},
	{
		"id": "john-bell-hood",
		"displayName": "Hood",
		"fullName": "John Bell Hood",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/people/john-bell-hood.htm",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm",
			"https://www.nps.gov/people/john-bell-hood.htm"
		],
		"profile": "Hood commanded a Confederate division before taking command of the Army of Tennessee.",
		"battleExample": "His division attacked the Union left at Gettysburg on July 2, 1863.",
		"description": "Hood commanded a Confederate division before taking command of the Army of Tennessee; his division attacked the Union left at Gettysburg on July 2, 1863."
	},
	{
		"id": "george-edward-pickett",
		"displayName": "Pickett",
		"fullName": "George Edward Pickett",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/people/george-edward-pickett.htm",
		"sourceUrls": [
			"https://www.nps.gov/people/george-edward-pickett.htm"
		],
		"profile": "Pickett commanded a Confederate infantry division in Longstreet's corps.",
		"battleExample": "His division participated in the July 3, 1863 Gettysburg assault known as Pickett's Charge.",
		"description": "Pickett commanded a Confederate infantry division in Longstreet's corps; his division participated in the July 3, 1863 Gettysburg assault known as Pickett's Charge."
	},
	{
		"id": "james-ewell-brown-stuart",
		"displayName": "J. E. B. Stuart",
		"fullName": "James Ewell Brown Stuart",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/people/james-ewell-brown-jeb-stuart.htm",
		"sourceUrls": [
			"https://www.nps.gov/articles/leading-the-charge.htm",
			"https://www.nps.gov/people/james-ewell-brown-jeb-stuart.htm"
		],
		"profile": "Stuart commanded cavalry in the Confederate Army of Northern Virginia.",
		"battleExample": "His cavalry protected Confederate flanks and artillery at the Second Battle of Manassas.",
		"description": "Stuart commanded cavalry in the Confederate Army of Northern Virginia; his cavalry protected Confederate flanks and artillery at the Second Battle of Manassas."
	},
	{
		"id": "john-brown-gordon",
		"displayName": "Gordon",
		"fullName": "John Brown Gordon",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm"
		],
		"profile": "Gordon commanded a Georgia brigade in Ewell's Confederate corps.",
		"battleExample": "His brigade helped drive Union troops through Gettysburg on July 1, 1863.",
		"description": "Gordon commanded a Georgia brigade in Ewell's Confederate corps; his brigade helped drive Union troops through Gettysburg on July 1, 1863."
	},
	{
		"id": "edward-porter-alexander",
		"displayName": "Alexander",
		"fullName": "Edward Porter Alexander",
		"side": "Confederate",
		"role": "Artillery commander",
		"sourceUrl": "https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm"
		],
		"profile": "Alexander commanded a reserve artillery battalion in Longstreet's Confederate corps.",
		"battleExample": "He directed the bombardment preceding Pickett's Charge at Gettysburg on July 3, 1863.",
		"description": "Alexander commanded a reserve artillery battalion in Longstreet's Confederate corps; he directed the bombardment preceding Pickett's Charge at Gettysburg on July 3, 1863."
	},
	{
		"id": "lewis-addison-armistead",
		"displayName": "Armistead",
		"fullName": "Lewis Addison Armistead",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm"
		],
		"profile": "Armistead commanded a Confederate brigade in Pickett's division.",
		"battleExample": "He was wounded after reaching the Union line during Pickett's Charge at Gettysburg.",
		"description": "Armistead commanded a Confederate brigade in Pickett's division; he was wounded after reaching the Union line during Pickett's Charge at Gettysburg."
	},
	{
		"id": "eppa-hunton",
		"displayName": "Hunton",
		"fullName": "Eppa Hunton",
		"side": "Confederate",
		"role": "Colonel at Gettysburg; later general",
		"sourceUrl": "https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm"
		],
		"profile": "Hunton commanded the 8th Virginia Infantry before becoming a Confederate brigadier general.",
		"battleExample": "He led his regiment and was wounded during Pickett's Charge at Gettysburg.",
		"description": "Hunton commanded the 8th Virginia Infantry before becoming a Confederate brigadier general; he led his regiment and was wounded during Pickett's Charge at Gettysburg."
	},
	{
		"id": "jubal-anderson-early",
		"displayName": "Early",
		"fullName": "Jubal Anderson Early",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/mono/learn/historyculture/jubalearly.htm",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm",
			"https://www.nps.gov/mono/learn/historyculture/jubalearly.htm"
		],
		"profile": "Early was a Confederate general who led the Army of the Valley District.",
		"battleExample": "He commanded Confederate forces at Monocacy during the 1864 advance toward Washington, D.C.",
		"description": "Early was a Confederate general who led the Army of the Valley District; he commanded Confederate forces at Monocacy during the 1864 advance toward Washington, D.C."
	},
	{
		"id": "james-johnston-pettigrew",
		"displayName": "Pettigrew",
		"fullName": "James Johnston Pettigrew",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm",
		"sourceUrls": [
			"https://www.nps.gov/gett/learn/historyculture/confederate-commanders-at-gettysburg.htm"
		],
		"profile": "Pettigrew led a North Carolina brigade at Gettysburg.",
		"battleExample": "He commanded a division in the July 3, 1863 assault on the Union center.",
		"description": "Pettigrew led a North Carolina brigade at Gettysburg; he commanded a division in the July 3, 1863 assault on the Union center."
	},
	{
		"id": "thomas-jonathan-jackson",
		"displayName": "T. J. Jackson",
		"fullName": "Thomas Jonathan Jackson",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://home.nps.gov/people/thomas-j-stonewall-jackson.htm",
		"sourceUrls": [
			"https://home.nps.gov/people/thomas-j-stonewall-jackson.htm"
		],
		"profile": "Jackson, called Stonewall, commanded the Second Corps of the Confederate Army of Northern Virginia.",
		"battleExample": "He directed the capture of the Union garrison at Harpers Ferry in September 1862.",
		"description": "Jackson, called Stonewall, commanded the Second Corps of the Confederate Army of Northern Virginia; he directed the capture of the Union garrison at Harpers Ferry in September 1862."
	},
	{
		"id": "joseph-eggleston-johnston",
		"displayName": "J. E. Johnston",
		"fullName": "Joseph Eggleston Johnston",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/people/joseph-e-johnston.htm",
		"sourceUrls": [
			"https://www.nps.gov/people/joseph-e-johnston.htm"
		],
		"profile": "Johnston was a senior Confederate general who commanded armies in Virginia and the western theater.",
		"battleExample": "He directed arriving Confederate reinforcements at First Manassas on July 21, 1861.",
		"description": "Johnston was a senior Confederate general who commanded armies in Virginia and the western theater; he directed arriving Confederate reinforcements at First Manassas on July 21, 1861."
	},
	{
		"id": "albert-sidney-johnston",
		"displayName": "A. S. Johnston",
		"fullName": "Albert Sidney Johnston",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/people/albert-sidney-johnston.htm",
		"sourceUrls": [
			"https://www.nps.gov/people/albert-sidney-johnston.htm"
		],
		"profile": "Johnston commanded Confederate forces across a large western region early in the war.",
		"battleExample": "He led the attack at Shiloh and was mortally wounded on April 6, 1862.",
		"description": "Johnston commanded Confederate forces across a large western region early in the war; he led the attack at Shiloh and was mortally wounded on April 6, 1862."
	},
	{
		"id": "pierre-gustave-toutant-beauregard",
		"displayName": "Beauregard",
		"fullName": "Pierre Gustave Toutant Beauregard",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://home.nps.gov/people/pgt-beauregard.htm",
		"sourceUrls": [
			"https://www.nps.gov/pete/learn/historyculture/beauregard.htm",
			"https://home.nps.gov/people/pgt-beauregard.htm"
		],
		"profile": "Beauregard was a Confederate general with engineering and artillery experience.",
		"battleExample": "He commanded Confederate forces during the bombardment of Fort Sumter in April 1861.",
		"description": "Beauregard was a Confederate general with engineering and artillery experience; he commanded Confederate forces during the bombardment of Fort Sumter in April 1861."
	},
	{
		"id": "braxton-bragg",
		"displayName": "Bragg",
		"fullName": "Braxton Bragg",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/people/braxton-bragg.htm",
		"sourceUrls": [
			"https://www.nps.gov/civilwar/search-battles-detail.htm?battleCode=MS001",
			"https://www.nps.gov/people/braxton-bragg.htm"
		],
		"profile": "Bragg commanded the Confederate Army of Tennessee for much of 1862 and 1863.",
		"battleExample": "His army defeated William Rosecrans's Union army at Chickamauga in September 1863.",
		"description": "Bragg commanded the Confederate Army of Tennessee for much of 1862 and 1863; his army defeated William Rosecrans's Union army at Chickamauga in September 1863."
	},
	{
		"id": "sterling-price",
		"displayName": "Price",
		"fullName": "Sterling Price",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/people/sterling-price.htm",
		"sourceUrls": [
			"https://www.nps.gov/civilwar/search-battles-detail.htm?battleCode=MS001",
			"https://www.nps.gov/people/sterling-price.htm"
		],
		"profile": "Price led the Missouri State Guard before becoming a Confederate major general.",
		"battleExample": "His 1864 invasion of Missouri ended in defeat at Westport.",
		"description": "Price led the Missouri State Guard before becoming a Confederate major general; his 1864 invasion of Missouri ended in defeat at Westport."
	},
	{
		"id": "earl-van-dorn",
		"displayName": "Van Dorn",
		"fullName": "Earl Van Dorn",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://home.nps.gov/people/earl-van-dorn.htm",
		"sourceUrls": [
			"https://www.nps.gov/civilwar/search-battles-detail.htm?battleCode=MS001",
			"https://home.nps.gov/people/earl-van-dorn.htm"
		],
		"profile": "Van Dorn commanded Confederate armies and later served as a cavalry commander.",
		"battleExample": "His forces attacked Union positions at Pea Ridge in March 1862 and were defeated.",
		"description": "Van Dorn commanded Confederate armies and later served as a cavalry commander; his forces attacked Union positions at Pea Ridge in March 1862 and were defeated."
	},
	{
		"id": "jefferson-davis",
		"displayName": "Jefferson Davis",
		"fullName": "Jefferson Davis",
		"side": "Confederate",
		"role": "President",
		"sourceUrl": "https://www.nps.gov/people/jefferson-davis.htm",
		"sourceUrls": [
			"https://www.nps.gov/civilwar/overview.htm",
			"https://www.nps.gov/people/jefferson-davis.htm"
		],
		"profile": "Davis served as president of the Confederacy during the Civil War.",
		"battleExample": "He appointed Robert E. Lee to lead the Army of Northern Virginia in June 1862.",
		"description": "Davis served as president of the Confederacy during the Civil War; he appointed Robert E. Lee to lead the Army of Northern Virginia in June 1862."
	},
	{
		"id": "william-joseph-hardee",
		"displayName": "Hardee",
		"fullName": "William Joseph Hardee",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://www.loc.gov/item/2021669721/",
		"sourceUrls": [
			"https://www.loc.gov/item/2021669721/"
		],
		"profile": "Hardee was a Confederate general and author of an infantry tactics manual used by both sides.",
		"battleExample": "He withdrew his troops from Savannah before Sherman's occupation of the city.",
		"description": "Hardee was a Confederate general and author of an infantry tactics manual used by both sides; he withdrew his troops from Savannah before Sherman's occupation of the city."
	},
	{
		"id": "leonidas-polk",
		"displayName": "Polk",
		"fullName": "Leonidas Polk",
		"side": "Confederate",
		"role": "General",
		"sourceUrl": "https://www.nps.gov/people/leonidas-polk.htm",
		"sourceUrls": [
			"https://www.nps.gov/people/leonidas-polk.htm"
		],
		"profile": "Polk was an Episcopal bishop who became a Confederate lieutenant general.",
		"battleExample": "He commanded a Confederate corps at the Battle of Shiloh in 1862.",
		"description": "Polk was an Episcopal bishop who became a Confederate lieutenant general; he commanded a Confederate corps at the Battle of Shiloh in 1862."
	}
]
	.map(c => ({
		...c, faction: c.side, side: c.side === 'Union' ? 1 : 0, name: c.displayName, summary: c.profile, strategy: c.battleExample, sourceTitle: c.sourceUrl.includes('archives.gov') ? 'National Archives' : c.sourceUrl.includes('loc.gov') ? 'Library of Congress' : 'National Park Service'
	}));
export const PRESENCE_GRACE_MS = 90000;
export function seatAvailable(p, now) {
	return now - p.lastSeen <= PRESENCE_GRACE_MS;
}
export function assignCommander(students, pool = COMMANDERS, now = Date.now()) {
	const used = new Set([...students.values()].map(p => p.commander?.id));
	const counts = [0, 0];
	for (const p of students.values())
		if (seatAvailable(p, now))
			counts[p.commander.side]++;
	const side = counts[0] <= counts[1] ? 0 : 1;
	const available = pool.filter(c => c.side === side && !used.has(c.id));
	if (!available.length)
		throw Error('No unused commander is available for the balancing faction. The teacher must open a new classroom; existing aliases are reserved for reconnect.');
	return structuredClone(available[randomInt(available.length)]);
}
export function pairRoster(order, students, shuffle, now) {
	const sides = [[], []], waiting = [];
	for (const id of order) {
		const p = students.get(id);
		if (!p?.commander || ![0, 1].includes(p.commander.side))
			throw Error('A seat has no valid faction assignment.');
		if (seatAvailable(p, now))
			sides[p.commander.side].push(id);
		else
			waiting.push(id);
	}
	const red = shuffle(sides[0]), blue = shuffle(sides[1]), count = Math.min(red.length, blue.length), paired = [];
	for (let i = 0; i < count; i++)
		paired.push(red[i], blue[i]);
	return {
		order: [...paired, ...red.slice(count), ...blue.slice(count), ...waiting], pairedCount: paired.length
	};
}
