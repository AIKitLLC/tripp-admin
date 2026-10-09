export type CardOrientation = 'upright' | 'reversed';
export type CardSuit = 'wands' | 'cups' | 'swords' | 'pentacles';
export type CardRank = 'ace' | 'two' | 'three' | 'four' | 'five' | 'six' | 'seven' | 'eight' | 'nine' | 'ten' | 'page' | 'knight' | 'queen' | 'king';
export interface CardDefinition {
  readonly id: number;
  readonly name: string;
  readonly english: string;
  readonly arcana: 'major' | 'minor';
  readonly suit: CardSuit | null;
  readonly rank: CardRank | null;
  readonly glyph: string;
  readonly symbol: string;
  readonly symbolEnglish: string;
  readonly upright: string;
  readonly reversed: string;
  readonly uprightEnglish: string;
  readonly reversedEnglish: string;
}
export interface Card {
  id: number;
  name: string;
  english: string;
  orientation: CardOrientation;
  meaning: string;
  meaningEnglish: string;
  glyph: string;
  symbol: string;
  symbolEnglish: string;
  arcana: 'major' | 'minor';
  suit: CardSuit | null;
  rank: CardRank | null;
}

// Original reflective wording about conventional Rider–Waite–Smith symbols.
// Major IDs remain stable for previously stored readings. No artwork is copied.
const major = [
  ['Kẻ Lữ Hành', 'The Fool', 'Một khởi đầu cần sự tò mò và một bước nhỏ.', 'Chậm lại trước khi bước vào điều chưa biết.', '✧'],
  ['Nhà Kiến Tạo', 'The Magician', 'Nhìn lại nguồn lực bạn đang có và dùng một kỹ năng cụ thể.', 'Thu hẹp ý tưởng để biến một điều thành hành động.', '✦'],
  ['Nữ Tư Tế', 'The High Priestess', 'Lắng nghe cảm xúc và phân biệt trực giác với dữ kiện.', 'Tìm thông tin còn thiếu trước khi kết luận.', '☾'],
  ['Hoàng Hậu', 'The Empress', 'Nuôi dưỡng bản thân và dành chỗ cho sự sáng tạo.', 'Nhìn lại việc chăm sóc mình khi đang chăm sóc người khác.', '❋'],
  ['Hoàng Đế', 'The Emperor', 'Một cấu trúc rõ ràng giúp bạn giữ ranh giới.', 'Nới sự kiểm soát và thử một cách tổ chức mềm hơn.', '◇'],
  ['Người Thầy', 'The Hierophant', 'Tìm điều bạn học được từ một người hoặc một truyền thống.', 'Xem lại quy tắc nào còn phù hợp với giá trị của bạn.', '⌘'],
  ['Đôi Tình Nhân', 'The Lovers', 'Lựa chọn theo giá trị của bạn và giao tiếp rõ ràng.', 'Nhìn lại điểm lệch giữa mong muốn và hành động.', '♡'],
  ['Cỗ Xe', 'The Chariot', 'Chọn một hướng đi và một bước trong tầm kiểm soát.', 'Giảm tốc để biết mình đang đi vì điều gì.', '△'],
  ['Sức Mạnh', 'Strength', 'Sự kiên nhẫn và lòng tử tế giúp bạn giữ vững mình.', 'Thừa nhận mệt mỏi và chọn cách hỗ trợ bản thân.', '∞'],
  ['Ẩn Sĩ', 'The Hermit', 'Một khoảng yên tĩnh giúp bạn nhìn rõ nhu cầu.', 'Tìm kết nối an toàn khi khoảng riêng thành cô lập.', '✴'],
  ['Bánh Xe', 'Wheel of Fortune', 'Nhìn điều đang thay đổi và điều bạn có thể điều chỉnh.', 'Tách điều ngoài kiểm soát khỏi bước bạn có thể làm.', '⊙'],
  ['Công Lý', 'Justice', 'Xem dữ kiện, trách nhiệm và tính công bằng trong lựa chọn.', 'Kiểm tra giả định trước khi phán xét mình hoặc người khác.', '⚖'],
  ['Người Treo Ngược', 'The Hanged Man', 'Đổi góc nhìn và cho mình thời gian trước khi phản ứng.', 'Nhìn lại sự trì hoãn nào đang làm bạn mắc kẹt.', '▽'],
  ['Chuyển Hóa', 'Death', 'Một kết thúc tượng trưng mở chỗ cho cách sống mới.', 'Nhìn điều bạn đang giữ vì sợ thay đổi. Lá này không dự báo cái chết.', '⋈'],
  ['Tiết Chế', 'Temperance', 'Tìm một nhịp sống vừa sức và cân bằng các nhu cầu.', 'Điều chỉnh một thói quen nhỏ thay vì ép mình đổi tất cả.', '◈'],
  ['Ràng Buộc', 'The Devil', 'Nhìn thói quen hoặc áp lực khiến bạn khó tự do lựa chọn.', 'Thử một ranh giới nhỏ để bớt lệ thuộc vào thói quen.', '⟡'],
  ['Tòa Tháp', 'The Tower', 'Một giả định lung lay là dịp kiểm tra lại nền tảng.', 'Chuẩn bị hỗ trợ và thay đổi từng phần có thể kiểm soát.', '⋀'],
  ['Ngôi Sao', 'The Star', 'Hy vọng có thể bắt đầu từ một việc nhỏ và thực tế.', 'Tìm một nguồn hỗ trợ khi bạn thấy mất phương hướng.', '☆'],
  ['Mặt Trăng', 'The Moon', 'Cảm xúc và điều chưa rõ cần được quan sát nhẹ nhàng.', 'Gọi tên điều bạn biết và điều bạn chưa biết.', '☽'],
  ['Mặt Trời', 'The Sun', 'Nhận ra điều mang lại năng lượng và sự cởi mở.', 'Cho mình thời gian hồi phục trước khi đòi hỏi lạc quan.', '☀'],
  ['Tiếng Gọi', 'Judgement', 'Nhìn lại bài học và chọn bước tiếp theo với lòng tự trọng.', 'Giảm tự phán xét và nhận ra điều bạn đã học.', '✺'],
  ['Thế Giới', 'The World', 'Ghi nhận một chặng đường và điều bạn muốn mang theo.', 'Hoàn thành một việc còn dang dở theo nhịp của bạn.', '◎'],
] as const;

const majorDetail = [
  ['Người lữ hành bên vách đá với hành lý nhẹ.','A traveller at a cliff with a light bag.','Meet a beginning with curiosity and one small step.','Slow down and check your footing before an unfamiliar step.'],
  ['Bàn dụng cụ nối ý định với hành động.','A table of tools connects intention with action.','Notice your resources and put one specific skill to work.','Narrow your ideas so one intention becomes an action.'],
  ['Hai cột trụ, tấm màn và cuộn sách.','Two pillars, a veil and a scroll.','Listen to feelings while distinguishing intuition from evidence.','Seek missing information before reaching a conclusion.'],
  ['Vườn cây và lúa chín gợi sự nuôi dưỡng.','A garden and ripe grain suggest nourishment.','Make room for nourishment, rest and creativity.','Check whether caring for others has crowded out your own care.'],
  ['Ngai đá và núi gợi ranh giới, cấu trúc.','A stone throne and mountains suggest structure.','Use a clear structure to protect your boundaries.','Loosen rigid control and try a more flexible structure.'],
  ['Người thầy, hai người học và những chiếc chìa khóa.','A teacher, two learners and crossed keys.','Consider what a teacher or tradition has helped you learn.','Review which inherited rules still fit your values.'],
  ['Hai người dưới một thiên thần gợi kết nối và lựa chọn.','Two people beneath an angel suggest connection and choice.','Choose in line with your values and communicate openly.','Notice mismatched needs or communication; do not assume another person’s thoughts.'],
  ['Cỗ xe giữa hai lực kéo khác hướng.','A chariot between two contrasting forces.','Choose a direction and a step within your control.','Slow down and ask what is guiding your effort.'],
  ['Một người bình tĩnh cạnh sư tử, không dùng bạo lực.','A calm figure beside a lion, without force.','Steady patience and kindness can support a clear boundary.','Acknowledge fatigue and find support rather than forcing yourself.'],
  ['Chiếc đèn nhỏ soi đường trong khoảng riêng.','A small lantern lights a solitary path.','A quiet pause may help you understand your needs.','Seek safe connection when solitude starts to feel isolating.'],
  ['Bánh xe chuyển động giữa các biểu tượng.','A turning wheel among contrasting symbols.','Notice what is changing and what you can adjust.','Separate what you cannot control from a step you can take.'],
  ['Cán cân và thanh kiếm gợi dữ kiện, trách nhiệm.','Scales and a sword invite evidence and responsibility.','Consider evidence, responsibility and fairness in your choices.','Check assumptions before judging yourself or someone else.'],
  ['Một người tạm dừng ở góc nhìn khác.','A suspended figure sees a different perspective.','Try a different perspective and pause before reacting.','Notice when waiting has become an avoidable standstill.'],
  ['Cờ hoa trắng và mặt trời xa gợi chuyển tiếp.','A white flower banner and distant sun suggest transition.','A symbolic ending may make room for change; this card does not predict death.','Notice what you hold because change feels hard; this card does not predict death.'],
  ['Nước chuyển giữa hai cốc, một chân trên đất.','Water moves between two cups, one foot on land.','Find a manageable rhythm between competing needs.','Adjust one small habit rather than demanding total change.'],
  ['Những sợi xích lỏng gợi thói quen có thể xem lại.','Loose chains suggest reconsiderable habits and pressures.','Notice a habit or pressure that makes choice feel harder.','Try one small boundary that loosens an unhelpful habit.'],
  ['Sét chạm tòa tháp gợi một giả định cần kiểm tra.','Lightning touches a tower: an assumption may need review.','Review a challenged assumption rather than expecting disaster.','Arrange support and manageable changes; this is not a disaster prediction.'],
  ['Một người rót nước dưới những ngôi sao.','A figure pours water beneath stars.','Hope can begin with one small, practical act.','Look for a source of support when direction feels unclear.'],
  ['Con đường dưới ánh trăng và giữa hai tháp.','A moonlit path between two towers.','Observe feelings and uncertainty without treating them as proof.','Name what you know and what remains unknown.'],
  ['Ánh nắng, hoa hướng dương và sự cởi mở.','Sunlight, sunflowers and openness.','Notice what brings energy and openness.','Allow recovery before asking yourself to feel optimistic.'],
  ['Tiếng kèn gọi các nhân vật đứng dậy nhìn lại.','A trumpet calls figures to rise and reflect.','Review what you learned and choose a step with self-respect.','Ease self-judgement and recognise what experience taught you.'],
  ['Vòng lá bao quanh một nhân vật gợi trọn một chặng đường.','A wreath surrounding a figure suggests a completed stage.','Acknowledge a completed stage and what to carry forward.','Complete an unfinished task at a pace that works for you.'],
] as const;

// Order per suit: Ace, 2–10, Page, Knight, Queen, King. Every entry is original.
const ranks: readonly CardRank[] = ['ace','two','three','four','five','six','seven','eight','nine','ten','page','knight','queen','king'];
const rankVi = ['Át','Hai','Ba','Bốn','Năm','Sáu','Bảy','Tám','Chín','Mười','Tiểu Đồng','Kỵ Sĩ','Nữ Hoàng','Vua'];
const rankEn = ['Ace','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Page','Knight','Queen','King'];
const suitVi: Record<CardSuit, string> = { wands: 'Gậy', cups: 'Cốc', swords: 'Kiếm', pentacles: 'Tiền' };
const suitEn: Record<CardSuit, string> = { wands: 'Wands', cups: 'Cups', swords: 'Swords', pentacles: 'Pentacles' };
const suitGlyph: Record<CardSuit, string> = { wands: '✦', cups: '♡', swords: '⚔', pentacles: '◇' };
type MinorText = readonly [string,string,string,string,string,string];
const minorText: Record<CardSuit, readonly MinorText[]> = {
  wands: [
    ['Bàn tay cầm gậy đang nảy lá.','A hand holds a sprouting wand.','Một tia hứng thú đáng thử bằng bước nhỏ.','Tìm lại năng lượng trước khi nhận thêm việc.','Try a spark of interest with one small action.','Reconnect with your energy before taking on more.'],
    ['Một người nhìn xa với quả địa cầu.','A figure looks outward holding a globe.','So sánh hướng đi với nguồn lực thực tế.','Thu nhỏ kế hoạch khi lựa chọn làm bạn choáng.','Compare directions with the resources you have.','Make the plan smaller when choices feel overwhelming.'],
    ['Một người nhìn những con thuyền từ bờ.','A figure watches ships from the shore.','Xem bước đầu và chuẩn bị bước kế tiếp.','Điều chỉnh kỳ vọng khi tiến độ khác dự tính.','Review early progress and prepare the next step.','Adjust expectations when progress differs from the plan.'],
    ['Vòm hoa trên bốn gậy và lời chào đón.','A flower canopy on four wands welcomes a gathering.','Ghi nhận sự hỗ trợ và cột mốc nhỏ.','Nói rõ điều giúp bạn thấy được chào đón.','Appreciate support and a small milestone.','Name what would help you feel welcome.'],
    ['Năm người cầm gậy theo hướng khác nhau.','Five figures hold wands in different directions.','Tách khác biệt ý kiến khỏi công kích cá nhân.','Đưa bất đồng về một việc cụ thể có thể bàn.','Separate disagreement from personal attacks.','Bring tension back to a concrete issue you can discuss.'],
    ['Người cưỡi ngựa mang vòng lá trước đám đông.','A rider wears a wreath before a crowd.','Ghi nhận nỗ lực và chia sẻ công lao.','Đo tiến bộ theo giá trị của bạn, không chỉ lời khen.','Recognise effort and share credit.','Measure progress by your values as well as praise.'],
    ['Một người giữ vị trí trước sáu cây gậy.','A figure holds a position above six wands.','Giữ ranh giới rõ mà không cần thắng mọi tranh luận.','Chọn điều đáng bảo vệ để bớt kiệt sức.','Hold a boundary without winning every argument.','Choose which boundaries deserve your energy.'],
    ['Tám cây gậy đi qua bầu trời mở.','Eight wands cross an open sky.','Giao tiếp ngắn gọn và sắp thứ tự việc đang tới.','Chậm lại khi nhiều việc cùng đến.','Communicate clearly and order incoming tasks.','Pause before reacting to several demands at once.'],
    ['Một người nghỉ cạnh hàng gậy, vẫn quan sát.','A resting figure remains attentive beside wands.','Tôn trọng sức bền và nhu cầu nghỉ của mình.','Nhận hỗ trợ thay vì luôn tự phòng bị.','Respect your persistence and your need for rest.','Accept support instead of staying constantly on guard.'],
    ['Một người mang bó gậy lớn trên đường về.','A figure carries a heavy bundle of wands.','Xem trách nhiệm nào có thể chia sẻ hoặc giảm bớt.','Buông việc không cần gánh một mình.','Review responsibilities you can share or reduce.','Set down a task you need not carry alone.'],
    ['Người học quan sát cây gậy nảy lá.','A learner examines a sprouting wand.','Thử kỹ năng mới bằng bài tập nhỏ.','Thử ý tưởng trước khi hứa quá nhiều.','Explore a new skill with a small exercise.','Test an idea before promising too much.'],
    ['Kỵ sĩ trên ngựa chuyển động, tay cầm gậy.','A moving rider carries a wand.','Dùng nhiệt tình cho một hành động có chuẩn bị.','Kiểm tra hậu quả trước khi hành động vì hứng khởi.','Put enthusiasm into a prepared action.','Check consequences before acting on excitement.'],
    ['Một người cầm hoa hướng dương và gậy.','A figure holds a sunflower and a wand.','Thể hiện tự tin cùng sự tôn trọng.','Nuôi lại lòng tin qua việc nhỏ thay vì so sánh.','Express confidence while respecting others.','Rebuild confidence through small acts, not comparison.'],
    ['Người trên ngai cầm cây gậy nảy lá.','A seated figure holds a sprouting wand.','Biến tầm nhìn thành hướng dẫn rõ, vừa sức.','Lắng nghe góp ý trước khi áp đặt hướng đi.','Turn a vision into manageable guidance.','Listen to feedback before imposing a direction.'],
  ],
  cups: [
    ['Chiếc cốc tràn nước trên mặt hồ.','A cup overflows above a pool.','Dành chỗ cho cảm xúc và cách chăm sóc dịu dàng.','Gọi tên cảm xúc trước khi cố làm vừa lòng người khác.','Make room for a feeling and gentle care.','Name your feelings before trying to please others.'],
    ['Hai người nâng cốc ngang hàng.','Two figures raise cups as equals.','Tìm trao đổi có lắng nghe và đồng thuận.','Nói nhu cầu khi nhịp kết nối chưa tương xứng.','Seek mutual listening and consent.','State your needs when connection feels uneven.'],
    ['Ba người nâng cốc trong một vòng tròn.','Three figures raise cups in a circle.','Nhận nâng đỡ từ bạn bè hoặc cộng đồng an toàn.','Kiểm tra nhóm nào cho phép bạn là chính mình.','Accept support from friends or a safe community.','Notice which groups let you be yourself.'],
    ['Một người ngồi dưới cây trước những cốc.','A figure sits beneath a tree with cups nearby.','Cho mình nghỉ để nhận ra nhu cầu thật.','Quan sát lời mời nhỏ khi đã sẵn sàng.','Pause to understand what you need.','Notice a small invitation when you feel ready.'],
    ['Những cốc đổ và hai cốc còn đứng.','Spilled cups sit beside two still upright.','Thừa nhận hụt hẫng và hỗ trợ còn lại.','Cho nỗi buồn chỗ đứng, không ép quên ngay.','Acknowledge disappointment and remaining support.','Allow grief space without demanding instant closure.'],
    ['Hai người trao chiếc cốc có hoa.','Two figures exchange a cup filled with flowers.','Giữ ký ức ấm áp và kiểm tra hiện tại.','Nhận ra khi hoài niệm che nhu cầu hôm nay.','Keep a helpful memory while checking present realities.','Notice when nostalgia obscures today’s needs.'],
    ['Nhiều cốc chứa hình ảnh khác nhau giữa mây.','Several cups hold contrasting images in clouds.','Phân biệt mong muốn, lựa chọn và dữ kiện.','Chọn phương án nhỏ có thể kiểm chứng.','Distinguish wishes, options and evidence.','Choose one small option you can test.'],
    ['Một người rời các cốc về phía núi.','A figure walks away from cups toward hills.','Xem điều không còn đáp ứng nhu cầu của bạn.','Đánh giá kỹ trước quyết định rời đi.','Review what no longer meets your needs.','Allow time to evaluate before choosing to leave.'],
    ['Một người ngồi trước dãy cốc ngay ngắn.','A seated figure rests before a row of cups.','Ghi nhận niềm vui giản dị và điều đủ.','Xem sự hài lòng có hợp nhu cầu sâu hơn không.','Appreciate a simple pleasure and enoughness.','Check whether satisfaction serves deeper needs.'],
    ['Cầu vồng có cốc trên những người ở cạnh nhau.','A rainbow of cups appears above people together.','Nói kiểu gắn kết an toàn bạn muốn xây dựng.','Giảm áp lực về hình ảnh gia đình hoàn hảo.','Describe the safe connection you want to build.','Ease pressure to match a perfect family picture.'],
    ['Một người nhìn cá ló ra khỏi cốc.','A figure notices a fish peeking from a cup.','Đón cảm xúc bằng tò mò và lời nhẹ nhàng.','Kiểm tra cảm xúc trước khi coi tưởng tượng là kết luận.','Meet feelings with curiosity and gentle words.','Check feelings before making imagination a conclusion.'],
    ['Kỵ sĩ chậm rãi mang một chiếc cốc.','A rider carries a cup at a measured pace.','Bày tỏ thiện ý bằng lời đi cùng hành động.','Kiểm tra kỳ vọng lãng mạn bằng giao tiếp và đồng thuận.','Express care through words matched by actions.','Check romantic hopes against communication and consent.'],
    ['Một người nhìn cốc có nắp cạnh mặt nước.','A figure studies a covered cup beside water.','Lắng nghe cảm xúc mà vẫn giữ ranh giới.','Chăm mình trước khi ôm hết cảm xúc người khác.','Listen with empathy while keeping boundaries.','Care for yourself before carrying everyone’s feelings.'],
    ['Người giữ cốc trên ngai giữa mặt nước.','A figure holds a cup on a throne amid water.','Giữ bình tĩnh để diễn đạt cảm xúc rõ.','Gọi tên điều bị nén thay vì giả vờ ổn.','Stay grounded enough to express feelings clearly.','Name a suppressed feeling instead of pretending to be fine.'],
  ],
  swords: [
    ['Thanh kiếm hướng lên có vòng lá trên đỉnh.','An upright sword carries a wreath at its tip.','Làm rõ câu hỏi và dữ kiện cần kiểm tra.','Xem giả định khi lời giải có vẻ quá dễ.','Clarify a question and the evidence it needs.','Review assumptions when an answer seems too simple.'],
    ['Một người che mắt giữ hai kiếm cân bằng.','A blindfolded figure balances two swords.','Tìm thông tin và thời gian cho lựa chọn khó.','Chia lựa chọn thành phần nhỏ để bớt né tránh.','Seek information and time for a difficult choice.','Break a choice into smaller parts instead of avoiding it.'],
    ['Ba kiếm xuyên trái tim dưới mây mưa.','Three swords cross a heart beneath rain clouds.','Thừa nhận tổn thương; biểu tượng không chứng minh phản bội.','Chữa lành theo nhịp riêng, không đoán người khác đã làm gì.','Acknowledge hurt; the symbol is not evidence of betrayal.','Allow your pace of healing without guessing another’s actions.'],
    ['Một người nằm nghỉ gần những thanh kiếm.','A resting figure lies near swords.','Dành khoảng hồi phục trước việc khó.','Sắp xếp nghỉ khi tâm trí liên tục bị kéo đi.','Make space for recovery before a difficult task.','Arrange a pause when your mind feels constantly pulled away.'],
    ['Một người giữ kiếm khi người khác rời đi.','A figure holds swords as others walk away.','Xem cái giá của việc cố thắng bất đồng.','Chọn đối thoại hoặc rời tranh luận theo ranh giới an toàn.','Consider the cost of winning a disagreement.','Choose dialogue or leave an argument within safe boundaries.'],
    ['Thuyền chở người và kiếm qua mặt nước.','A boat carries people and swords across water.','Tìm chuyển tiếp nhẹ hơn với sự hỗ trợ.','Nhận điều cần xử lý dù hoàn cảnh đã đổi.','Look for a gentler transition with support.','Notice what still needs attention after circumstances change.'],
    ['Một người mang kiếm, nhìn về phía sau.','A figure carries swords while looking back.','Kiểm tra sự rõ ràng; lá này không chứng minh lừa dối.','Làm rõ điều chưa nói, không giả định có người lừa bạn.','Review clarity; this card is not proof of deception.','Clarify what was unsaid without assuming deception.'],
    ['Người che mắt giữa kiếm, phía trước còn lối.','A blindfolded figure stands among swords with space ahead.','Tách giới hạn thật khỏi điều đang giả định.','Tìm lựa chọn nhỏ và người giúp nhìn rõ hơn.','Distinguish real constraints from assumed ones.','Find a small option and support to see it.'],
    ['Một người thức trên giường dưới dãy kiếm.','A waking figure sits beneath a row of swords.','Gọi tên lo lắng và tìm hỗ trợ; lá không chẩn đoán sức khỏe.','Chia sẻ điều nặng lòng với hỗ trợ phù hợp, không tự chẩn đoán.','Name a worry and seek support; this card is not a diagnosis.','Share what feels heavy with suitable support, without self-diagnosing.'],
    ['Những kiếm và đường chân trời có ánh sáng.','Swords appear beneath a horizon with light.','Thừa nhận quá sức; hình ảnh không dự báo tổn hại hay cái chết.','Hồi phục từng bước với hỗ trợ, không coi biểu tượng là dự báo.','Acknowledge overwhelm; the image predicts neither injury nor death.','Recover with support, without treating a symbol as a forecast.'],
    ['Người học giữ kiếm trong gió.','A learner holds a sword in the wind.','Đặt câu hỏi rõ và kiểm tra nguồn tin.','Chậm lại trước khi phản hồi điều chưa xác minh.','Ask clearly and check information sources.','Pause before responding to unverified information.'],
    ['Kỵ sĩ hướng tới trước với thanh kiếm.','A rider moves forward carrying a sword.','Dùng tập trung cho mục tiêu có cân nhắc.','Hạ nhịp khi lời nói hoặc hành động quá gấp.','Use focus for a considered goal.','Slow down when words or actions become rushed.'],
    ['Một người giữ kiếm và mở bàn tay kia.','A figure holds a sword and extends an open hand.','Nói ranh giới rõ cùng sự tôn trọng.','Giữ lòng mềm mại khi nói điều khó nghe.','Express a clear boundary with respect.','Keep compassion while saying something difficult.'],
    ['Người ngồi thẳng với kiếm hướng lên.','A seated figure holds an upright sword.','Dùng tiêu chí rõ và dữ kiện để suy xét.','Kiểm tra quyền lực và định kiến khi quyết định.','Use clear criteria and evidence when reasoning.','Check power and bias in decision-making.'],
  ],
  pentacles: [
    ['Bàn tay nâng đồng xu trên khu vườn.','A hand holds a coin above a garden.','Bắt đầu thói quen thực tế; không coi lá là lời khuyên đầu tư.','Kiểm tra nguồn lực trước cam kết, không dựa vào lá để đầu tư.','Start a practical habit; this is not an investment recommendation.','Check resources before committing, not cards before investing.'],
    ['Một người cân hai đồng xu trong vòng nối.','A figure balances two coins in a looping ribbon.','Sắp nhu cầu khi thời gian và nguồn lực có hạn.','Giảm một việc khi cân bằng không còn vừa sức.','Prioritise needs within limited time and resources.','Reduce a demand when juggling becomes unsustainable.'],
    ['Ba người trao đổi quanh một công trình.','Three figures discuss a shared structure.','Học qua hợp tác, góp ý và kỹ năng tích lũy.','Làm rõ vai trò khi nhóm chưa phối hợp được.','Learn through cooperation, feedback and accumulated skills.','Clarify roles when a group is not working together.'],
    ['Một người giữ đồng xu sát mình.','A figure holds coins close.','Xem điều giúp an toàn và giới hạn hợp lý.','Nới chỗ cứng nhắc đang cản hỗ trợ hoặc học hỏi.','Review what gives security and a reasonable boundary.','Loosen rigidity that blocks support or learning.'],
    ['Hai người qua cửa sổ sáng trong tuyết.','Two figures pass a lit window in snow.','Nhận nhu cầu hỗ trợ thực tế khi thấy thiếu thốn.','Tìm nguồn giúp đỡ phù hợp, không tự trách.','Notice a need for practical support when resources feel scarce.','Seek appropriate help without blaming yourself.'],
    ['Một người trao xu và giữ cán cân.','A figure shares coins while holding scales.','Xem cho và nhận có công bằng, tự nguyện không.','Nói giới hạn khi giúp đỡ có điều kiện khó chịu.','Check whether giving and receiving are fair and voluntary.','State a limit when help has uncomfortable conditions.'],
    ['Một người nhìn cây đã chăm sóc.','A figure reviews a tended plant.','Đánh giá nỗ lực theo thời gian và điều có thể đổi.','Xem lại luyện tập khi kết quả chưa như mong muốn.','Review effort over time and what can be adjusted.','Reconsider practice when results differ from your hopes.'],
    ['Người thợ tạo từng đồng xu cẩn thận.','A craftsperson works carefully on individual coins.','Luyện kỹ năng đều đặn qua bài tập nhỏ.','Cân bằng luyện tập với nghỉ và góp ý cụ thể.','Practise steadily through small exercises.','Balance practice with rest and specific feedback.'],
    ['Một người trong vườn với chim trên tay.','A figure stands in a garden with a bird on one hand.','Ghi nhận tự chăm sóc và thành quả vừa sức.','Định nghĩa đủ đầy theo giá trị riêng, không vẻ ngoài.','Recognise self-care and manageable progress.','Define enough by your values rather than appearances.'],
    ['Nhiều thế hệ cạnh đồng xu và mái nhà.','Several generations and coins share a household.','Xem nền tảng lâu dài và trách nhiệm có thể chia sẻ.','Bàn rõ kỳ vọng gia đình hoặc công việc.','Review long-term foundations and shared responsibilities.','Discuss family or work expectations rather than assuming them.'],
    ['Người học quan sát đồng xu trong tay.','A learner studies a coin in their hands.','Chọn kiến thức nền và bài tập đầu tiên.','Chia mục tiêu học thành việc có thể hoàn thành.','Choose a learning foundation and first exercise.','Break a learning goal into a finishable task.'],
    ['Kỵ sĩ dừng ở đồng đất với đồng xu.','A rider pauses in a field holding a coin.','Tiến đều đặn và kiểm tra kế hoạch.','Đổi thói quen khi cẩn thận thành trì trệ.','Proceed steadily and review the plan.','Change a habit when caution becomes stagnation.'],
    ['Một người giữ đồng xu giữa khu vườn.','A figure holds a coin in a garden.','Chăm nhu cầu thực tế của mình vừa sức.','Giữ thời gian và nguồn lực cho mình khi chăm người khác.','Care for practical needs sustainably.','Keep time and resources for yourself while caring for others.'],
    ['Người trên ngai giữa cây cối giữ đồng xu.','A seated figure holds a coin amid plants.','Dùng kinh nghiệm xây nền tảng, không bảo đảm kết quả.','Xem khi mục tiêu vật chất lấn át sức khỏe và quan hệ.','Use experience to build a foundation without guaranteeing results.','Notice when material goals crowd out health and relationships.'],
  ],
};

export const DECK_SIZE = 78;
export const DECK: readonly CardDefinition[] = Object.freeze([
  ...major.map(([name, english, upright, reversed, glyph], id) => {
    const [symbol, symbolEnglish, uprightEnglish, reversedEnglish] = majorDetail[id];
    return Object.freeze({ id, name, english, arcana: 'major' as const, suit: null, rank: null, glyph, symbol, symbolEnglish, upright, reversed, uprightEnglish, reversedEnglish });
  }),
  ...(['wands','cups','swords','pentacles'] as const).flatMap((suit, suitIndex) => ranks.map((rank, rankIndex) => {
    const [symbol, symbolEnglish, upright, reversed, uprightEnglish, reversedEnglish] = minorText[suit][rankIndex];
    return Object.freeze({ id: 22 + suitIndex * 14 + rankIndex, name: `${rankVi[rankIndex]} ${suitVi[suit]}`,
      english: `${rankEn[rankIndex]} of ${suitEn[suit]}`, arcana: 'minor' as const, suit, rank, glyph: suitGlyph[suit], symbol, symbolEnglish, upright, reversed, uprightEnglish, reversedEnglish });
  })),
]);

export function cardById(id: number, orientation: CardOrientation): Card {
  if (!Number.isSafeInteger(id) || id < 0 || id >= DECK_SIZE) throw new Error('card_id');
  if (orientation !== 'upright' && orientation !== 'reversed') throw new Error('card_orientation');
  const card = DECK[id];
  return { id, name: card.name, english: card.english, orientation,
    meaning: orientation === 'upright' ? card.upright : card.reversed,
    meaningEnglish: orientation === 'upright' ? card.uprightEnglish : card.reversedEnglish,
    glyph: card.glyph, symbol: card.symbol, symbolEnglish: card.symbolEnglish, arcana: card.arcana, suit: card.suit, rank: card.rank };
}

/** Rejection sampling avoids modulo bias; cards and orientations use crypto randomness. */
function randomBelow(limit: number): number {
  const ceiling = Math.floor(0x100000000 / limit) * limit;
  const random = new Uint32Array(1);
  do { crypto.getRandomValues(random); } while (random[0] >= ceiling);
  return random[0] % limit;
}

/** Caller persists atomically before returning; retry uses the stored result. */
export function drawCards(count: number, excludeIds: readonly number[] = []): Card[] {
  if (!Array.isArray(excludeIds) || excludeIds.some(id => !Number.isSafeInteger(id) || id < 0 || id >= DECK_SIZE)) throw new Error('card_exclusion');
  const excluded = new Set(excludeIds);
  const ids = DECK.map(card => card.id).filter(id => !excluded.has(id));
  if (!Number.isSafeInteger(count) || count < 1 || count > ids.length) throw new Error('draw_count');
  // Partial Fisher–Yates uniformly samples an ordered subset without replacement.
  for (let index = 0; index < count; index++) {
    const selected = index + randomBelow(ids.length - index);
    [ids[index], ids[selected]] = [ids[selected], ids[index]];
  }
  return ids.slice(0, count).map(id => cardById(id, randomBelow(2) === 0 ? 'upright' : 'reversed'));
}
