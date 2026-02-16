# @sokinternet/p4w4

Capacitor main interface with native code.

## Install

```bash
npm install @sokinternet/p4w4
npx cap sync
```

## API

<docgen-index>

* [`echo(...)`](#echo)
* [`reverse(...)`](#reverse)
* [`resizeWebView(...)`](#resizewebview)
* [`offsetTopWebView(...)`](#offsettopwebview)
* [`getStatusBarHeight()`](#getstatusbarheight)
* [`setStartupHtml(...)`](#setstartuphtml)
* [`resetBadgeCount()`](#resetbadgecount)
* [`playNotificationBell(...)`](#playnotificationbell)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### echo(...)

```typescript
echo(options: { value: string; }) => Promise<{ value: string; }>
```

| Param         | Type                            |
| ------------- | ------------------------------- |
| **`options`** | <code>{ value: string; }</code> |

**Returns:** <code>Promise&lt;{ value: string; }&gt;</code>

--------------------


### reverse(...)

```typescript
reverse(options: { value: string; }) => Promise<{ value: string; }>
```

| Param         | Type                            |
| ------------- | ------------------------------- |
| **`options`** | <code>{ value: string; }</code> |

**Returns:** <code>Promise&lt;{ value: string; }&gt;</code>

--------------------


### resizeWebView(...)

```typescript
resizeWebView(options: { offset: number; }) => Promise<void>
```

| Param         | Type                             |
| ------------- | -------------------------------- |
| **`options`** | <code>{ offset: number; }</code> |

--------------------


### offsetTopWebView(...)

```typescript
offsetTopWebView(options: { offset: number; }) => Promise<void>
```

| Param         | Type                             |
| ------------- | -------------------------------- |
| **`options`** | <code>{ offset: number; }</code> |

--------------------


### getStatusBarHeight()

```typescript
getStatusBarHeight() => Promise<{ height: number; }>
```

**Returns:** <code>Promise&lt;{ height: number; }&gt;</code>

--------------------


### setStartupHtml(...)

```typescript
setStartupHtml(options: { file: string; }) => Promise<void>
```

| Param         | Type                           |
| ------------- | ------------------------------ |
| **`options`** | <code>{ file: string; }</code> |

--------------------


### resetBadgeCount()

```typescript
resetBadgeCount() => Promise<void>
```

--------------------


### playNotificationBell(...)

```typescript
playNotificationBell(options?: { soundId?: number | undefined; durationMs?: number | undefined; } | undefined) => Promise<void>
```

| Param         | Type                                                    |
| ------------- | ------------------------------------------------------- |
| **`options`** | <code>{ soundId?: number; durationMs?: number; }</code> |

--------------------

</docgen-api>
