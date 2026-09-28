// Tailwind 3 binds data-alternate to the nth child after the arbitrary
// descendant variant. The attribute is on Timeline, not TimelineItem.
function timelineAlternateCompat(){return {postcssPlugin:'shadcn-timeline-alternate-compat',OnceExit(root){let count=0;root.walkRules(rule=>{
 if(!rule.selector?.includes('timeline-item\\]\\:nth-child\\(even\\)\\]\\:flex-row-reverse'))return;
 const old='>[data-slot=timeline-item]:nth-child(even)[data-alternate="true"]';
 if(!rule.selector.endsWith(old)||!rule.nodes.some(n=>n.prop==='flex-direction'&&n.value==='row-reverse'))throw Error('Unexpected timeline alternate selector');
 rule.selector=rule.selector.replace(old,'[data-alternate="true"] > [data-slot=timeline-item]:nth-child(even)');count++;
});if(count!==1)throw Error(`Expected one alternate Timeline selector, got ${count}`)}}}
module.exports={timelineAlternateCompat};
