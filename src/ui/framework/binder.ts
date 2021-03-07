import Log from "../../helpers/logger";
import BindingContext from "./contexts/bindingContext";
import Observable from "./observable";


// Base for a binding on a viewmodel.
type BindingBase<TViewModel, TKind> = Partial<Record<keyof TViewModel, TKind>>;


/**
 * A binding that only updates a view (the target) when the viewmodel has changed.
 */
export type ToTarget<TView> = keyof TView;


/**
 * A binding that only updates a viewmodel (the source) when the view has changed.
 */
export type ToSource<TView> = { update: keyof TView };


/**
 * A binding that only updates a view (the target) when the viewmodel (the source) 
 * has changed, and also updates the viewmodel when the view has changed.
 */
export type TwoWay<TView> = { bind: keyof TView, update: keyof TView };


/**
 * An object that defines all bindings between a viewmodel (the source) and a view 
 * (the target).
 */
export type Bindings<TViewModel, TView> = BindingBase<TViewModel, ToTarget<TView> | ToSource<TView> | TwoWay<TView>>;


/**
 * Applies a specific binding to the view-model, returns true if succesful or false 
 * if it could not find a suitable observable to bind to.
 */
function applyBinding<TView, TViewModel>(context: BindingContext<TView>, viewmodel: TViewModel, bindings: Bindings<TViewModel, TView>, bindSource: Extract<keyof TViewModel, string>): boolean
{
	const observable = viewmodel[bindSource];
	if (observable === undefined)
	{
		return false;
	}
	if (!(observable instanceof Observable))
	{
		Log.debug(`Binding failed: Observable is not an observable, but of type '${typeof observable}'`);
		return false;
	}

	const binding = bindings[bindSource];
	if (typeof (binding) === "string") // one way to target
	{
		const toTarget = binding as ToTarget<TView>;

		context.setField(toTarget, observable.get());
		observable.subscribe(value => context.setField(toTarget, value));

		Log.debug(`Binding created: '${bindSource}' -> '${toTarget}'`);
	}
	else if ("update" in binding)
	{
		// one way to source
		const toSource = binding as ToSource<TView>; 
		context.setField(toSource.update, <any>((v: unknown) => observable.set(v)));

		if ("bind" in binding) // two way
		{
			const twoWay = binding as TwoWay<TView>;
			const toTarget = twoWay.bind;

			context.setField(toTarget, observable.get());
			observable.subscribe(value => context.setField(toTarget, value));

			Log.debug(`Binding created: '${bindSource}' <-> '${toTarget}:${twoWay.update}'`);
		}
		else
		{
			Log.debug(`Binding created: '${bindSource}' <- '${toSource.update}'`);
		}
	}
	return true;
}


/**
 * A binder module that can bind a context to viewmodels.
 */
module Binder
{
	/**
	 * Binds a view context to a viewmodel through selected bindings.
	 * 
	 * @param context The context of the view (target).
	 * @param viewmodel The viewmodel (source) to bind to.
	 * @param bindings The properties to bind to.
	 */
	export function apply<TView, TViewModel>(context: BindingContext<TView>, viewmodel: TViewModel, bindings: Bindings<TViewModel, TView>)
	{
		for (let bindSource in bindings) // on the viewmodel
		{
			if (!applyBinding(context, viewmodel, bindings, bindSource))
			{
				Log.warning(`Could not find observable property on viewmodel for '${bindSource}'`);
			}
		}
	}


	/**
	 * Binds a view context to multiple viewmodels through selected bindings.
	 * 
	 * @param context The context of the view (target).
	 * @param viewmodels The viewmodels (source) to bind to.
	 * @param bindings The properties to bind to.
	 */
	export function applyAll<TView, TViewModel>(context: BindingContext<TView>, viewmodels: TViewModel[], bindings: Bindings<TViewModel, TView>)
	{
		for (let bindSource in bindings) // on the viewmodel
		{
			let success = false;
			for (let vm of viewmodels)
			{
				success = (applyBinding(context, vm, bindings, bindSource) || success);
			}

			if (!success)
			{
				Log.warning(`Could not find observable property on any viewmodels for '${bindSource}'`);
			}
		}
	}
}
export default Binder;