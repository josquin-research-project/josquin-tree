/** index.js    D. McClure, K. Grossner
  * interface to load static or API data, render trees
  */

import $ from 'jquery';
import d3 from 'd3';
// linked module from https://github.com/davidmcclure/suffix-tree
import SuffixTree from 'suffix-tree';
// expose d3 functions like selectAll
window.d3 = d3;

// load sample data from files regardless
import rawA from './data/notes_JosSongs.json';
import rawB from './data/notes_OckSongs.json';

/**
  * set data source
  */
var datasource = 'local' // or 'api'

var root = '',
    apitreeA = '',
    apitreeB = '',
    apinotesA = new Array,
    apinotesB = new Array,
    notes = '',
    notesSet = '',
    svgSet = '',
    counterClass = '',
    reverseTree = '',
    svgX = 45,
    raw = '',
    newRoot=[]

let w = 650;
let h = 720;

let cluster = d3.layout.cluster()
  .size([h, w-220]);

let diagonal = d3.svg.diagonal()
  .projection(function(d) {
    return [d.y, d.x];
  });

let diagonalR = d3.svg.diagonal()
  .projection(function(d) {
    return [w-d.y, d.x];
  });

var svgA = d3.select('#rootA')
  .append('svg')
  .attr('id', 'tree')
  .attr('width', w)
  .attr('height', h)
  .append('g')

var svgB = d3.select('#rootB')
  .append('svg')
  .attr('id', 'tree')
  .attr('width', w)
  .attr('height', h)
  .append('g')

function scaleNode(val,range) {
  let s = d3.scale.linear()
    .domain(range)
    .range([3,15]);
  return s(val);
}

function scaleText(val,range) {
  let s = d3.scale.linear()
    .domain(range)
    .range([12,20]);
  return s(val);
}

/**
  * selection = 'A' or 'B'; source = 'local' or 'api'
  */
function loadData(selection, source) {
  let c = $('select[id="composer_'+selection+'"]').val()
  let g = $('select[id="genre_'+selection+'"]').val()
  if(source == 'local') {
    // assign appropriate file data to raw
    raw = selection == "A" ? rawA : rawB;
    notes = [];
    for(let r of raw) {
      for(let f of r.features.pitch) {
        for(let p of f) {
          notes.push(p);
        }
        notes.push('X');
      }
    }
    // maintain current local data for .click behaviors
    selection == 'A' ? apinotesA = notes : apinotesB = notes;
    // render selection A or B
    drawTree(selection, notes);
  } else if(source == 'api') {
    let url = 'http://josquin.stanford.edu/cgi-bin/jrp?a=notetree&f=' + c + '&genre='
    if (g !='') {url += g} else g='all'
    console.log('load '+c+' '+g+' data into graph '+selection)
    console.log('getting API data from', url);
    d3.json(url, function(error, raw) {
      console.log(error);
      notes = [];
      for(let r of raw) {
       for(let f of r.features.pitch) {
         for(let p of f) {
           notes.push(p);
         }
         notes.push('X');
       }
      }
      selection == 'A' ? apinotesA = notes : apinotesB = notes;
      drawTree(selection, notes);
     })
  }
}

var root = ''

function drawTree(selection, notes, start=null) {
  if(reverseTree) {
    console.log(reverseTree);
    svgX = -120;
  } else {
    svgX = 45;
  }
  svgA.attr('transform', 'translate('+svgX+',0)');
  svgB.attr('transform', 'translate('+svgX+',0)');

  var notesArr=[]
  notesArr.push(notes)

  if(selection == "A"){
    svgSet = svgA
    notesSet = apinotesA
    counterClass = '.countA'
  } else if(selection == "B"){
    svgSet = svgB
    notesSet = apinotesB
    counterClass = '.countB'
  }

  var notesArr=[]
  notesArr.push(notes)

  // build suffix-tree
  if( reverseTree ) {
    var tree = new SuffixTree(notesArr,true);
    } else {
    var tree = new SuffixTree(notesArr,false);
    }

  // display counters
  $(counterClass).text(`${notesSet.length.toLocaleString()} notes`)

  eval(svgSet).text('');

  if(start == null) {
    root = $('input[name="root"]').val();
    } else {
    $('input[name="root"]').val(start)
    root = start;
    // console.log('start(root)', root)
  }

  let depth = Number($('input[name="depth"]').val());
  let maxChildren = Number($('input[name="max-children"]').val());
  let minCountDisplay = Number($('input[name="min-count"]').val());
  let countDisplay = $('input[name="count_display"]:checked').val();
  // console.log('countDisplay',countDisplay)

  let data = tree.query(root, depth, maxChildren, minCountDisplay);
  let nodes = cluster.nodes(data);
  let links = cluster.links(nodes);
  window.l = links[7]
  // console.log('a link', links[7].source,links[7].target)
  // find min/max counts used to scale nodes and node labels
  var maxCount = d3.max(nodes, function(d){return d.count});
  var minCount = d3.min(nodes, function(d){return d.count});

  let link = svgSet.selectAll('.link')
    .data(links)
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', reverseTree ? diagonalR : diagonal)
    .attr('stroke-width', 4)

  let node = svgSet.selectAll('.node')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', function(d) {
      return reverseTree ?
        `translate(${650-d.y},${d.x})` :
        `translate(${d.y},${d.x})`;
    })
    .on('click', function(d) {
      newRoot = [];
      window.n = d;
      if (d3.event.shiftKey) {
        let rooty = recurseParents(d).reverse();
        console.log('rooty', rooty.join(','))
        drawTree(selection, notes, rooty.join(','));
      } else if (d3.event.altKey) {
        console.log('altKey');
      } else {
        drawTree(selection, notes, d.name);
      }
    });

  node.append('circle')
    .attr('r', function(d) {
      return scaleNode(d.count,[minCount,maxCount]);
    })
    .attr('fill',function() {
      return counterClass === '.countA' ? '#a25436' : '#2b75af'
    });

  // note letters
  node.append('text')
    .attr('x', 0)
    .attr('y', 0)
    .attr('dx', function(d) {
      return d.depth == 0 ? 10 : d.children ? -18 : -8;
    })
    // .attr('dy', depth == 0 ? -10 : )
    .attr('dy', function(d) {
      return d.depth == 0 ? -10 : ".35em";
    })
    .style("font-size", function(d) {
      return d.depth == 0 ? 30 : scaleText(d.count,[minCount,maxCount]) //+'px'
    })
    .style("text-anchor","end")
    .classed('leaf-text', function(d) {
      return !d.children;
    })
    .html(function(d) {
      return `${d.name}`;
    })

  // counts
  node.append('text')
    .attr('dx', function(d) {
      return d.depth == 0 ? 10 : d.children ? 30 : 12;
    })
    .attr('dy', ".35em")
    // .attr('dy', function(d) {
    //   return d.depth == 0 ? -10 : 3;
    // })
    .style("font-size", function(d) {
      return d.depth == 0 ? 30 : scaleText(d.count,[minCount,maxCount]) //+'px'
    })
    .style("text-anchor","start")
    .classed('leaf-text', function(d) {
      return !d.children;
    })
    .html(function(d) {
      if (d.depth == 0 || countDisplay == 'none') {
        return '';
      } else if (countDisplay == 'raw') {
        return `${d.count.toLocaleString()}`;
      } else if (countDisplay == 'pct') {
        if (d.depth == 2) {
          return `${(d.count/d.parent.count).toFixed(2).toLocaleString()}`;
        } else if (d.depth == 1) {
          let total = d3.sum(d.parent.children, function(d){return d.count})
          return `${(d.count/total).toLocaleString()}`;
        }
      };
    })
};

function recurseParents(node) {
  if(node) {
    // console.log('parent name', node.name)
    newRoot.push(node.name)
    // console.log('newRoot', newRoot)
    recurseParents(node.parent)
  }
  // console.log('newRoot', newRoot)
  return newRoot;
}

$(document).ready(function() {
  $('#rcheck').change(function (){
    if(this.checked) {
      reverseTree = true;
    } else { reverseTree = false;}

  })
  $('.b-load').click(function(){
    // console.log(this.value)
    loadData(this.value);
  });
  $('#b_render').click(function(){
    drawTree("A",apinotesA,$('input[name="root"]').val());
    drawTree("B",apinotesB,$('input[name="root"]').val());
  })
})

/**
  * initial load and draw
  */
loadData('A',datasource);
loadData('B',datasource);