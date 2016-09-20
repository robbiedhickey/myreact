class Dilithium {

  constructor() {
    // Bookkeeping bits, we need to store some data and ensure that no roots conflict
    this.ROOT_KEY = 'dlthmRootId';
    this.instancesByRootID = {};
    this.rootID = 1;
  }

  createElement(type, config, children) {
    // clone the passed in config (props). In react we move some special props off of this object (keys, refs). Won't implement here.
    let props = Object.assign({}, config);

    // Build props.children. We'll make it an array if we have more than 1
    let childCount = arguments.length - 2;
    if (childCount === 1) {
      props.children = children;
    } else if (childCount > 1) {
      props.children = [].slice.call(arguments, 2);
    }

    return {
      type,
      props
    };
  }

  isRoot(node) {
    return node.dataset[ROOT_KEY] ? true : false;
  }

  render(element, node) {
    assert(Element.isValidElement(element));

    // first check if we've already rendered into this node. If so, this is an update. Otherwise initial render.
    if(isRoot(node)){
      update(element, node);
    } else {
      mount(element, node);
    }
  }

  mount(element, node) {
    // create the internal instance. this abstracts away different component types.
    let component = instantiateComponent(element);

    // store this for later updates and unmounting
    instancesByRootID[rootID] = component;

    // mounting generates DOM nodes. This is where React determines if we're re-mounting server rendered content
    let renderedNode = Reconciler.mountComponent(component, node);

    // Do some DOM operations, marking this node as a root, and inserting the new DOM as a childCount
    node.dataset[ROOT_KEY] = rootID;
    DOM.empty(node);
    DOM.appendChild(node, renderedNode);
    rootID++;
  }

  update(element, node) {
    // find the internal instance and update it
    let id = node.dataset[ROOT_KEY];
    let instance = instancesByRootID[id];

    let prevItem = instance._currentElement;
    if(shouldUpdateComponent(prevElem, element)) {
      // Send the new element to the instance
      Reconciler.receiveComponent(instance, element);
    } else {
      // Unmount and then mount the new one
      unmountComponentAtNode(node);
      mount(element, node);
    }
  }

  // this determines if we're going to end up reusing an internal instance or not. 
  // this is one of the big shortcuts that react does, stopping us from instantiating and comparing full trees
  // instead we immediately throw away a subtree when updating from one element type to another
  // NOTE: this is totally different from shouldComponentUpdate :(
  shouldUpdateComponent(prevElement, nextElement) {
    // simple use element.type
    // 'div' !== 'span'
    // ColorSwatch !== CounterButton
    // NOTE: in react we would also look at the key
    return prevElement.type === nextElement.type;
  }

}

class Reconciler {

  mountComponent(component) {
    // this will generate the DOM node that will go into the DOM. we defer to the component instance since it will contain
    // the renderer specific impl of what that means. This allows the Reconciler to be reused across DOM & Native. 
    let markup = component.mountComponent();

    // React does more work here to ensure that refs work, we don't need to
    return markup;
  }

  receiveComponent(component, element) {
    // Shortcut! We don't do anything if the next element is the same as the current one.
    // This is unlikely in normal JSX usage, but it is an optimization that can be unlocked with Babel's inline-element transform
    let prevElem = component._currentElement;
    if(prevElem === element) {
      return;
    }

    // Defer to the instance
    component.receiveComponent(element);
  }

  unmountComponent(component) {
    // Again, React will do more work here for refs, we won't
    component.unmountComponent();
  }

  performUpdateIfNeccesary(component) {
    component.performUpdateIfNeccesary();
  }
}

class Component {
  constructor(props) {
    this.props = props;
    this._currentElement = null;
    this._pendingState = null;
    this._renderedComponent = null;
    this._renderedNode = null;

    assert(typeof this.render === 'function');
  }

  setState(partialState) {
    // react uses a queue here to allow batching
    this._pendingState = Object.assign({}, instance.state, partialState);
    Reconciler.performUpdateIfNeccesary(this);
  }

  // we have a helper method here to avoid having a wrapper instance. React does that, its a smarter impl and hides required helpers and internal data
  // that alos allows renderers to have their own implementation specific wrappers. This ensure React.Component is available on native. 
  _construct(element) {
    this._currentElement = element;
  }

  mountComponent() {
    // this is where the magic starts to happen, we call the render method to get our actual rendered element. Note: since react does not support Arrays or other types
    // we can safely assume this is an element. 
    let renderedElement = this.render();

    // TODO: call componentWillMount()

    // actually instantiate the rendered element
    let component = instantiateComponent(renderedElement);

    this._renderedComponent = component;

    // RECURSION! generate markup for component and recurse. Since composite components instances dont have a DOM representation of their own
    // this markup will actually bt the DOM nodes (or native views)
    let renderedNode = Reconciler.mountComponent(component, node);

    return renderedNode;
  }

  receiveComponent(nextElement){
    this.updateComponent(nextElement);
  }

  updateComponent(nextElement) {
    let prevElem = this._currentElement;

    // when just updating the state, nextElement will be the same as the previously rendered element. Otherwise, this update is the result of a parent re-rendering
    if(prevElem !== nextElement) {
      //TODO: call componentWillReceiveProps
    }

    // TODO: call shouldComponentUpdate and return false
    // TODO: call componentWillUpdate
    
    // Update instance data
    this._currentElement = nextElement;
    this.props = nextElement.props;
    if(this._pendingState) {
      this.state = this._pendingState;
    }
    this._pendingState = null;

    // we need the previously rendered element (render() result) to compare to the next render() result
    let prevRenderedElement = this._renderedComponent._currentElement;
    let nextRenderedElement = this.render();

    // Just like a top level update, determine if we should update or replace.
    let shouldUpdate = shouldUpdateComponent(prevRenderedElement, nextRenderedElement);

    if(shouldUpdate) {
      Reconciler.receiveComponent(this._renderedComponent, nextRenderedElement);
    } else {
      // Unmount the current component and instantiate the new one, replace content in the DOM
      Reconciler.unmountComponent(this._renderedComponent);

      let nextRenderedComponent = instantiateComponent(nextRenderedElement);
      let nextMarkup = Reonciler.mountComponent(nextRenderedComponent);
      DOM.replaceNode(this._renderedComponent._domNode, nextMarkup);
      this._renderedComponent = nextRenderedComponent;
    }
  }

  performUpdateIfNeccesary() {

  }
}

class DOMComponentWrapper extends MultiChild {
  constructor(element) {
    super();
    this._currentElement = element;
    this._domNode = null;
  }

  // very simple version, only for regular html elements
  mountComponent() {
    // create the DOM element, set attributes, recurse for children
    let el = document.createElement(this._currentElement.type);

    this._domNode = el;
    this._udpateDOMProperties({}, this._currentElement.props);
    this._createInitialDOMChildren(this._currentElement.props);
    return el;
  }

  _createInitialDOMChildren(props) {
    let childType = typeof props.children;

    // we'll take a short cut for text content
    if(childType === 'string' || childType === 'number'){
      this._domNode.textContent = props.children;
    }
    // single element or Array 
    else if (props.children) {
      let mountImages = this.mountChildren(props.children);

      DOM.appendChildren(this._domNode, mountImages);
    }
  }
}



class MultiChild {

  constructor() {
    this.UPDATE_TYPES = {
      INSERT: 1, 
      MOVE: 2,
      REMOVE: 3
    };

    this.OPERATIONS = {
      insert(component, node, afterNode) {
        return {
          type: UPDATE_TYPES.INSERT,
          content: node,
          toIndex: component._mountIndex,
          afterNode: afterNode
        };
      },

      move(component, afterNode, toIndex) {
        return {
          type: UPDATE_TYPES.MOVE,
          fromIndex: component._mountIndex,
          toIndex: toIndex,
          afterNode: afterNode
        };
      },

      remove(component, node) {
        return {
          type: UPDATE_TYPES.REMOVE,
          fromIndex: component._mountIndex,
          fromNode: node
        }
      }
    };
  }

  mountChildren(children) {
    // instantiate all of the actual child instances into a flat object. This handles all of the logic around flattening subarrays.
    // NOTE: we won't implement ChildReconciler
    let renderedChildren = ChildReconciler.instantiateChildren(children);
    this._renderedChildren = renderedChildren;

    /*
      // recall React < v0.14 data-react-id, this is where it comes from
      // important characteristics are that these are unique, and at the same time represent the depth of the tree.
      {
        '.0.0': { _currentElement, ... },
        '.0.1': { _currentElement, ... }
      } 
    */

    let mountImages = Object.keys(renderedChildren)
      .map((childKey, i) => {
        let child = renderedChildren[childKey];
        child._mountIndex = i;
        return Reconciler.mountComponent(child);
      });

    return mountImages;
  }

  unmountChildren() {
    let children = this._renderedChildren;
    Object.keys(children)
      .forEach((childKey) => {
        Reconciler.unmountComponent(children[childKey]);
      });
  }

  // the following is the bread and butter of react. We'll compare the currently rendered children to the next set. 
  // We need to determine which instances are being moved around, which are getting removed, and which are being inserted.
  // The ChildReconciler will do the initial work. NOTE: nextChildren is elements
  updateChildren(nextChildren) {
    let prevRenderedChildren = this._renderedChildren;

    // this works just like instantiateChildren but with elements
    let nextRenderedChildren = flattenChildren(nextChildren);
    /*
      {
        '.0.0': { type, ... },
        '.0.1': { type, ... }
      }
    */

    let mountImages = {};
    let removedNodes = {};
    // prevRenderedChildren is left alone *but* if a replace is detected, we unmount the instance, store that intances node in removeNodes.
    // nextRenderedChildren is mutated, it starts with elements but will be filled with instances after this call. 
    // these might be the previous instance if an update is detected, or a new one. Nodes for new instances are stored in removedNodes.
    ChildReconciler.updateChildren(prevRenderedChildren, nextRenderedChildren, mountImages, removedNodes);

    let lastIndex = 0;
    let nextMountIndex = 0;
    let lastPlacedNode = null;

    // store a series of update operations here.
    let updates = [];

    Object
      .keys(nextRenderedChildren)
      .forEach((childKey, nextIndex) => {
        let prevChild = prevRenderedChildren[childKey];
        let nextChild = nextRenderedChildren[childKey];

        // if they are the same this is an update
        if(prevChild === nextChild) {
          // we don't actually need to record a move if moving to a lower index, this means other needs will be removed or moved higher
          if(prevChild._mountIndex < lastIndex) {
            updates.push(OPERATIONS.move(prevChild, lastPlacedNode, nextIndex));
          }
          lastIndex = Math.max(prevChild._mountIndex, lastIndex);
          prevChild._mountIndex = nextIndex;
        }
        // otherwise we need to record an insertion. removes will be handled below 
        else {
          // first if we have a prevChild then we know it's a remove, update lastIndex
          if(prevChild) {
            lastIndex = Math.max(prevChild._mountIndex, lastIndex);
          }

          nextChild._mountIndex = nextIndex;
          updates.push(OPERATIONS.insert(nextChild, mountImages[nextMountIndex], lastPlacedNode));
          nextMountIndex++;
        }

        lastPlacedNode = nextChild._domNode;
      });

    // handle removals
    Object
      .keys(removedNodes)
      .forEach((childKey) => {
        updates.push(OPERATIONS.remove(prevRenderedChildren[childKey], removedNodes[childKey]));
      });
    
    // update internal state
    this._renderedChildren = nextRenderedChildren;

    // last but not least do the updates!
    processQueue(this._domNode, updates);
  }
}
