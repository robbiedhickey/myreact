# Building React from Scratch

> https://www.youtube.com/watch?v=_MAD4Oly9yg

Will not implement the full feature set, but will implement the critical surface APIs and include an example. We will call it Dilithium for distinction. 

## Top Level API

* Dilithium.createElement
* Dilithium.Component
* Dilithium.render

## Component Class API

* construtor()
* render()
* setState()
* this.props
* this.state

## Internal Component Lifecycle

1. constructor()
2. mountComponent()
  * generates DOM nodes and returns them. 
3. receiveComponent()
  * receive updates from parent components, parent component renders
4. updateComponent()
  * mostly an internal API, updates a component
5. unmountComponent()
  * release component from memory. 

## Base Class API (MultiChild) 

1. mountChildren()
2. updateChildren()
3. unmountChildren()



